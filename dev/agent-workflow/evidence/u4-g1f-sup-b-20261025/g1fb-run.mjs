/**
 * g1fb-run.mjs — G1-F supplement PoC runner (executor G1F-SUP-B).
 *
 * Default is --dry-run (read-only preflight + prints, zero spawn, zero world
 * writes). `--go --suite a|b` executes EXACTLY ONE bounded Host run:
 * 1 Host start, 30-min watchdog, port 3186 ONLY (sanctioned 3180-3186 family;
 * :3080 / ~/.dsh forbidden; executor A uses 3185 and another agent owns
 * 3180-3184 — never touched), env-scrubbed provider env pointing at the
 * loopback mock, owned-PID teardown, HTU porcelain/HEAD verification before
 * and after, and a ledger + FILESYSTEM + PROCESS/MARKER oracle independent of
 * tool return values (family files, server-side MCP markers, grant rows).
 *
 * Budget: shared project caps ≤2 Host starts / 5 experiments. Plan:
 *   E1 = dry/static preflight (no Host)          E2 = suite A (start 1)
 *   E3 = suite B (start 2)                       (E4/E5 = reserved for a
 *   fixture-bug retest — a consumed experiment is recorded in the ledger).
 *
 * suite A cells: PoC-1 (write/edit through the ONE generic registry:
 *   allow/deny-with-zero-file-effect/collision), PoC-2 (read+grep+bash on
 *   ONE ledger: allow/ask→approve→one-shot consume→replay refused/deny zero
 *   process/revoke-before-body + non-Team native control session), PoC-3
 *   (byte-extracted master Jobs bridge + owner fence + one shared grant
 *   admission + mount identity law with CI-08 plants), plus per-PoC
 *   sensitivity plants.
 * suite B cells: PoC-4b (mcp__* late binding after session start, unknown →
 *   refused BEFORE body with zero server-side effect, same-tool-name second
 *   server → no inheritance, admitted → executes, admission-disabled plant).
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-run
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DshInstance } from './instance.mjs'
import { startMockModel } from './mock-deepseek.mjs'
import { apiPrompt, apiSessionCreate, authenticate, probeNoToken } from './s1m1-session-client.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = resolve(HERE, '..', '..', '..', '..')
export const HTU = join(REPO, 'tests', 'deepseek-harness-test-use')
export const HTU_PIN = '639ed015397290b3745d163aafe02ffee4aa3f84'
export const CLIENT_COMMIT_HASH = '639ed01539'
export const HOST_ENTRY = join(HTU, 'apps', 'cli', 'lib', 'bin.js')
export const FAKE_KEY = 'g1fb-mock-key'
export const SANCTIONED_PORT = 3186
export const FORBIDDEN_PORTS = Object.freeze([3080, 3180, 3181, 3182, 3183, 3184, 3185])
export const WORLD_PREFIX = 'g1fb-'
export const RUN_BUDGET_MS = 30 * 60_000
export const BOOT_TIMEOUT_MS = 90_000
export const GROUP_WAIT_MS = 150_000
export const SCRUBBED_ENV_KEYS = Object.freeze([
  'DEEPSEEK_API_KEY', 'DEEPSEEK_SEARCH_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 'MISTRAL_API_KEY', 'AZURE_OPENAI_API_KEY',
])
export const PLUGIN_FILES = Object.freeze([
  'g1fb-lib.mjs', 'g1fb-ledger.mjs', 'g1fb-registry.mjs', 'g1fb-jobs-bridge.mjs',
  'g1fb-family-write.mjs', 'g1fb-family-edit.mjs', 'g1fb-family-read.mjs',
  'g1fb-family-grep.mjs', 'g1fb-family-bash.mjs', 'g1fb-family-jobs.mjs',
  'g1fb-mini-mcp-server.mjs', 'g1fb-probe-plugin.mjs',
])
export const MOCK_SHA256 = '8beade69588c105efb66df6a7a99dd915cb41b7aba91635ec0ebf73e6278fb06'
export const BRIDGE_RANGE = { file: join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'plane-effect-backends.mjs'), from: 1579, to: 1850, sha256: '71705d6eb1aaa9d0ae3fd22541f788a5dfb8dd07e6f96827db49e40283a9b29f' }
export const ZERO_DIFF_FILES = Object.freeze(['g1fb-lib.mjs', 'g1fb-ledger.mjs', 'g1fb-registry.mjs', 'g1fb-probe-plugin.mjs', 'g1fb-jobs-bridge.mjs'])
/** Governed tool names must NEVER appear in the generic center files
 *  (family-name branching check, memo §10.5-2). 'bash'/'grep'/'read' appear
 *  in g1fb-family-* files and comments of the BRIDGE only where master text
 *  carries it — the scan is on the registry+ledger+lib trio; the plugin is
 *  scanned for the family NAMES table only outside comments. */
export const GENERIC_NO_NAME_FILES = Object.freeze(['g1fb-registry.mjs', 'g1fb-ledger.mjs', 'g1fb-lib.mjs'])
export const GOVERNED_NAMES = Object.freeze(['write', 'edit', 'grep', 'job_list', 'job_output', 'job_kill'])

const PROMPT_A = 'G1FB-A-PROMPT'
const PROMPT_B = 'G1FB-B-PROMPT'
const PROMPT_AB = 'G1FB-AB-PROMPT'

export const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
export const utcStamp = (d = new Date()) => d.toISOString().replace(/[:]/g, '-').replace(/\.\d+Z$/, 'Z')
export function scrubProviderEnv() {
  const removed = []
  for (const key of SCRUBBED_ENV_KEYS) { if (process.env[key] !== undefined) { delete process.env[key]; removed.push(key) } }
  return removed
}
export function scrubSecrets(value, token = undefined) {
  let s = String(value)
  if (token !== undefined) s = s.split(token).join('REDACTED-TOKEN')
  return s
}

export function validateInputs({ port, worldName }) {
  if (port !== SANCTIONED_PORT || FORBIDDEN_PORTS.includes(port)) throw new Error(`port ${String(port)} rejected (this package uses 3186 only)`)
  if (!worldName.startsWith(WORLD_PREFIX)) throw new Error(`world must start with ${WORLD_PREFIX}`)
  if (basename(worldName) !== worldName || worldName.includes('..')) throw new Error('world must be a single safe basename')
  const world = join(REPO, 'tests', 'homes', worldName)
  if (existsSync(world)) throw new Error(`world path already exists: ${world}`)
  if (existsSync(`${world}.lock`)) throw new Error(`world lock already exists: ${world}.lock`)
  return world
}

/** Synchronous LISTEN-port snapshot from /proc (M3 precedent). */
export function procNetPorts() {
  const ports = new Set()
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let text = ''
    try { text = readFileSync(file, 'utf8') } catch { continue }
    for (const line of text.split('\n').slice(1)) {
      const cols = line.trim().split(/\s+/)
      if (cols.length < 4 || cols[3] !== '0A') continue
      const port = Number.parseInt(cols[1]?.split(':')?.[1] ?? '', 16)
      if (Number.isFinite(port)) ports.add(port)
    }
  }
  return ports
}

export function preflight({ port, suite }) {
  const git = (args) => spawnSync('git', ['-C', HTU, ...args], { encoding: 'utf8' }).stdout?.trim() ?? ''
  const bridgeText = (() => {
    try {
      const lines = readFileSync(BRIDGE_RANGE.file, 'utf8').split('\n').slice(BRIDGE_RANGE.from - 1, BRIDGE_RANGE.to).join('\n') + '\n'
      return createHash('sha256').update(lines).digest('hex')
    } catch { return '' }
  })()
  const pluginInBridge = readFileSync(join(HERE, 'g1fb-jobs-bridge.mjs'), 'utf8')
  const checks = [
    { check: 'port-is-3186-only', ok: port === SANCTIONED_PORT && !FORBIDDEN_PORTS.includes(port), detail: String(port) },
    { check: 'port-free-per-proc-net', ok: !procNetPorts().has(port), detail: String(port) },
    { check: 'htu-rev-parse-equals-pin', ok: git(['rev-parse', 'HEAD']) === HTU_PIN, detail: git(['rev-parse', 'HEAD']).slice(0, 12) },
    { check: 'htu-status-porcelain-empty', ok: git(['status', '--porcelain']) === '', detail: (git(['status', '--porcelain']) || 'empty').slice(0, 200) },
    { check: 'htu-entry-exists', ok: existsSync(HOST_ENTRY), detail: HOST_ENTRY },
    { check: 'mock-copy-bytes', ok: sha256File(join(HERE, 'mock-deepseek.mjs')) === MOCK_SHA256, detail: MOCK_SHA256.slice(0, 12) },
    { check: 'master-bridge-bytes-match-extraction', ok: bridgeText === BRIDGE_RANGE.sha256, detail: `${bridgeText.slice(0, 12)} vs ${BRIDGE_RANGE.sha256.slice(0, 12)} (sed ${String(BRIDGE_RANGE.from)}-${String(BRIDGE_RANGE.to)} @master)` },
    { check: 'bridge-copy-contains-master-text', ok: pluginInBridge.includes(readFileSync(BRIDGE_RANGE.file, 'utf8').split('\n').slice(BRIDGE_RANGE.from - 1, BRIDGE_RANGE.to).join('\n')), detail: 'byte-identical function text present in g1fb-jobs-bridge.mjs' },
    ...PLUGIN_FILES.map((f) => ({ check: `plugin-file:${f}`, ok: existsSync(join(HERE, f)), detail: f })),
    ...PLUGIN_FILES.map((f) => ({ check: `node-check:${f}`, ok: spawnSync(process.execPath, ['--check', join(HERE, f)], { encoding: 'utf8' }).status === 0, detail: f })),
    {
      check: 'generic-center-files-carry-no-family-names',
      ok: GENERIC_NO_NAME_FILES.every((f) => {
        const text = readFileSync(join(HERE, f), 'utf8').split('\n')
          .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
          .join('\n')
        return !GOVERNED_NAMES.some((n) => new RegExp(`'${n}'|"${n}"|\\b${n}\\b(?!\\w)`).test(text.replace(/job_\w+/g, 'JOBN')))
      }),
      detail: `scanned: ${GENERIC_NO_NAME_FILES.join(',')} for ${GOVERNED_NAMES.filter((n) => n !== 'read').join(',')} (literal tokens)`,
    },
    { check: 'world-dirs-free', ok: !readdirSync(join(REPO, 'tests', 'homes')).some((d) => d.startsWith(WORLD_PREFIX)), detail: 'no leftover g1fb-* homes' },
    { check: 'suite-known', ok: ['a', 'b', 'ab'].includes(suite), detail: suite },
  ]
  return checks
}

export function buildPatchText({ suite, world }) {
  const lines = [
    '# G1F-SUP-B: PoC rows through the public profile-patch seam (DshInstance.mountRows).',
    '# Probe plugin row + (suite b) two stdio mcp-client rows. Relative name',
    '# resolves beside this patch file (app-boot @639ed015). No preset, no Team row.',
    '- insert:',
    '    - id: g1fb-probe',
    '      name: "./g1fb-probe-plugin.mjs"',
  ]
  if (suite !== 'a') {
    const fixture = join(world, 'profiles', 'web', 'g1fb-mini-mcp-server.mjs').replace(/\\/g, '/')
    for (const s of ['alpha', 'beta']) {
      lines.push(
        `    - id: g1fb-mcp-${s}`,
        `      name: "@deepseek-ai/dsh-mcp-client"`,
        '      config:',
        `        serverName: ${s}`,
        '        transport: stdio',
        `        command: "${process.execPath}"`,
        '        args:',
        `          - "${fixture}"`,
        '        env:',
        `          G1F_MCP_NAME: ${s}`,
        `          G1F_MCP_MARKDIR: "${join(world, 'mcpmarks').replace(/\\/g, '/')}"`,
        ...(s === 'alpha' ? [`          G1F_MCP_WAKE: "${join(world, 'wake-alpha.flag').replace(/\\/g, '/')}"`] : []),
      )
    }
  }
  lines.push(
    '- id: session-log-deepseek',
    '  config:',
    '    enabled: false',
    '- id: plugin-package-inventory-deepseek',
    '  config:',
    '    enabled: false',
    '',
  )
  return lines.join('\n')
}

// ── case scripts ─────────────────────────────────────────────────────────────
const W = (id, tag, file_path, content) => ({ id, name: 'write', arguments: { tag, file_path, content } })
const E = (id, tag, file_path, old_string, new_string) => ({ id, name: 'edit', arguments: { tag, file_path, old_string, new_string } })
const RD = (id, tag, file_path) => ({ id, name: 'read', arguments: { tag, file_path } })
const GR = (id, tag, pattern, path) => ({ id, name: 'grep', arguments: { tag, pattern, path } })
const B = (id, tag, command, extra = {}) => ({ id, name: 'bash', arguments: { tag, command, ...extra } })
const JL = (id, tag, extra = {}) => ({ id, name: 'job_list', arguments: { tag, ...extra } })
const JO = (id, tag, job_id) => ({ id, name: 'job_output', arguments: { tag, job_id, timeout_ms: 8000 } })
const JK = (id, tag, job_id) => ({ id, name: 'job_kill', arguments: { tag, job_id } })
const C = (id, action, extra = {}) => ({ id, name: 'g1fb_ctl', arguments: { action, ...extra } })

// A0 — CI-03 mechanism control BEFORE any enrollment: the native file tools
// run with the center present but ZERO mounts; the E2 run additionally PROVED
// that a second session on this pin shares the single agent carrier (its rows
// carry the FIRST session's agent id), so agent-level enrollment scoping is
// the honest CI-03 boundary observable in one instance — disclosed in README.
export const GROUPS_A = Object.freeze([
  { name: 'A0-pre-enroll', session: 'S1', script: [
    { id: 'x01', name: 'g1fb_ctl', arguments: { action: 'status', tag: 'pre-enroll' } },
    { id: 'x02', name: 'write', arguments: { file_path: 'w/native-write.txt', content: 'NATIVE-WRITE' } },
    { id: 'x03', name: 'write', arguments: { file_path: 'w/native-write2.txt', content: 'NATIVE-WRITE-2' } },
    C('x04', 'settle', { tag: 'A0-pre-enroll' }),
  ] },
  { name: 'A1-poc1', session: 'S1', script: [
    C('c01', 'session-created'), C('c02', 'enroll', { label: 'S1' }),
    W('t01', 'p1a', 'w/ok.txt', 'G1F-OK'),
    W('t02', 'p1d', 'out/bad.txt', 'SHOULD-NEVER-EXIST'),
    E('t03', 'p1e', 'w/ok.txt', 'G1F-OK', 'G1F-EDITED'),
    C('c03', 'dupe-attempt', { by: 'P1-DUPE-WRITE2' }),
    C('c04', 'status', { tag: 'after-p1' }), C('c05', 'settle', { tag: 'A1-poc1' }),
  ] },
  { name: 'A2-poc2', session: 'S1', script: [
    RD('t10', 'p2a', 'data/note.txt'),
    RD('t11', 'p2d', 'secret/x.txt'),
    GR('t12', 'p2g1', 'needle', 'search/'),
    C('c10', 'approve', { name: 'grep' }),
    GR('t13', 'p2g2', 'needle', 'search/'),
    GR('t14', 'p2g3', 'needle', 'search/'),
    B('t15', 'p2bd', 'echo pwned > denydir/x.txt'),
    B('t16', 'p2q', 'echo askok > askdir/y.txt'),
    C('c11', 'approve', { name: 'bash' }),
    B('t17', 'p2q2', 'echo askok > askdir/y.txt'),
    B('t18', 'p2r', 'echo revoked > askdir/z.txt'),
    C('c12', 'revoke', { name: 'bash' }),
    B('t19', 'p2r2', 'echo revoked > askdir/z.txt'),
    B('t20', 'p2w', 'echo ok > w/shell.txt'),
    C('c13', 'grants', { tag: 'after-p2' }), C('c14', 'settle', { tag: 'A2-poc2' }),
  ] },
  { name: 'A4-poc3', session: 'S1', script: [
    B('t30', 'p3s', 'echo JOBOUT-p3s && echo JOBOUT-p3s > w/jobfile.txt', { background: true }),
    JL('t31', 'p3l'),
    JO('t32', 'p3o', '{{JOBID}}'),
    C('c30', 'bridge-fence', { jobId: '{{JOBID}}', asViewer: 'S3-synthetic' }),
    C('c31', 'svc-calls', { tag: 'after-fence' }),
    C('c32', 'regen', { name: 'job_list' }),
    JL('t33', 'p3r2'),
    C('c33', 'dispose-old', { name: 'job_list' }),
    JL('t34', 'p3r3'),
    C('c34', 'bridge-dump', { tag: 'attr' }), C('c35', 'settle', { tag: 'A4-poc3' }),
  ] },
  { name: 'A5-plants', session: 'S1', script: [
    C('c40', 'plant', { flag: 'pathGuardEnabled', on: false }),
    W('t40', 'p1pl', 'out/plant.txt', 'PLANT-P1'),
    C('c41', 'plant', { flag: 'pathGuardEnabled', on: true }),
    C('c42', 'plant', { flag: 'ledgerEnabled', on: false }),
    B('t41', 'p2pl', 'echo planted > denydir/p.txt'),
    C('c43', 'plant', { flag: 'ledgerEnabled', on: true }),
    C('c44', 'plant', { flag: 'identityLawEnabled', on: false }),
    C('c45', 'regen', { name: 'job_list' }),
    C('c46', 'dispose-old', { name: 'job_list' }),
    JL('t42', 'p3p4'),
    C('c47', 'heal'), C('c48', 'status', { tag: 'final' }), C('c49', 'settle', { tag: 'A5-plants' }),
  ] },
])

export const GROUPS_B = Object.freeze([
  { name: 'B0-stamp', session: 'S1', script: [C('d01', 'session-created'), C('d02', 'enroll', { label: 'SB' }), C('d03', 'settle', { tag: 'B0-stamp' })] },
  // runner touches the alpha wake file after B0 and waits for the discovery row
  { name: 'B1-late-bind', session: 'S1', script: [
    C('d04', 'status', { tag: 'watched' }),
    { id: 'e01', name: 'mcp__alpha__ping', arguments: { msg: 'b1', tag: 'b1' } },
    C('d05', 'admit-mcp', { name: 'mcp__alpha__ping' }),
    { id: 'e02', name: 'mcp__alpha__ping', arguments: { msg: 'b2', tag: 'b2' } },
    { id: 'e03', name: 'mcp__beta__ping', arguments: { msg: 'b3', tag: 'b3' } },
    C('d06', 'admit-mcp', { name: 'mcp__beta__ping' }),
    { id: 'e04', name: 'mcp__beta__ping', arguments: { msg: 'b4', tag: 'b4' } },
    C('d07', 'settle', { tag: 'B1-late-bind' }),
  ] },
  { name: 'B2-plants', session: 'S1', script: [
    C('d08', 'plant', { flag: 'dynamicAdmissionEnabled', on: false }),
    C('d09', 'forget-mcp', { name: 'mcp__beta__ping' }),
    { id: 'e05', name: 'mcp__beta__ping', arguments: { msg: 'b5', tag: 'b5' } },
    C('d10', 'heal'),
    { id: 'e06', name: 'mcp__beta__ping', arguments: { msg: 'b6', tag: 'b6' } },
    C('d11', 'settle', { tag: 'B2-plants' }),
  ] },
])

export const GROUPS_AB = Object.freeze([...GROUPS_A, ...GROUPS_B])
export const SCRIPT_A = Object.freeze(GROUPS_A.flatMap((g) => g.script))
export const SCRIPT_B = Object.freeze(GROUPS_B.flatMap((g) => g.script))
export const SCRIPT_AB = Object.freeze(GROUPS_AB.flatMap((g) => g.script))
export const SUITE_MARKER = Object.freeze({ a: PROMPT_A, b: PROMPT_B, ab: PROMPT_AB })
export const SUITE_GROUPS = Object.freeze({ a: GROUPS_A, b: GROUPS_B, ab: GROUPS_AB })

/** decide(): one script per run keyed by the suite prompt marker; {{JOBID}}
 *  is substituted from the live ledger (the p3s body-end row). Circuit
 *  breakers per the sealed H0 runaway postmortem (maxRepeat/maxTotal). */
export function makeDecideG1F({ ledgerPath, groups, marker: markerHere = PROMPT_A, onProbe = () => {} } = {}) {
  let lastId; let repeat = 0; let issues = 0; let probes = 0
  return ({ req }) => {
    const messages = Array.isArray(req?.messages) ? req.messages : []
    const flat = JSON.stringify(messages)
    if (probes < 6) {
      probes += 1
      const toolNames = (Array.isArray(req?.tools) ? req.tools : []).map((t) => t?.function?.name ?? t?.name ?? '?')
      onProbe({ msgCount: messages.length, toolsCount: toolNames.length, hasCtl: toolNames.includes('g1fb_ctl'), hasWrite: toolNames.includes('write'), hasMcpAlpha: toolNames.includes('mcp__alpha__ping'), hasMcpBeta: toolNames.includes('mcp__beta__ping') })
    }
    if (!flat.includes(markerHere)) return { kind: 'text', content: 'g1fb-idle' }
    // GROUP GATE: serve only entries of groups whose NAME appears in the
    // conversation (the runner issues one prompt per group, never N+1 before
    // N settled). Without this the model drains the WHOLE concatenated script
    // inside the first turn and per-group ordering (e.g. the mcp
    // wake-before-calls ordering) is meaningless.
    const script = groups.filter((g) => flat.includes(g.name)).flatMap((g) => g.script)
    if (script.length === 0) return { kind: 'text', content: 'g1fb-idle-no-group' }
    const answered = (id) => messages.some((m) => {
      if (m?.role === 'tool' && (m.tool_call_id === id || m.toolCallId === id)) return true
      for (const part of Array.isArray(m?.content) ? m.content : []) {
        if (part?.type === 'tool_result' && (part.tool_use_id === id || part.toolCallId === id)) return true
      }
      return false
    })
    const nextEntry = script.find((entry) => !answered(`gf-${entry.id}`))
    if (nextEntry === undefined) return { kind: 'text', content: 'g1fb-complete' }
    const id = `gf-${nextEntry.id}`
    repeat = lastId === id ? repeat + 1 : 1
    lastId = id
    issues += 1
    if (repeat > 8 || issues > 500) return { kind: 'text', content: `g1fb-circuit-break entry=${nextEntry.id} repeat=${String(repeat)} issues=${String(issues)}` }
    let args = nextEntry.arguments
    if (JSON.stringify(args).includes('{{JOBID}}')) {
      const rows = readLedgerRows(ledgerPath ?? '')
      const born = rows.find((r) => r.leg === 'body-end' && r.name === 'bash' && r.tag === 'p3s' && typeof r.job_id === 'string')
      if (born === undefined) return { kind: 'text', content: 'g1fb-waiting-jobid' }
      args = JSON.parse(JSON.stringify(args).replaceAll('{{JOBID}}', born.job_id))
    }
    return { kind: 'tool-call', toolCalls: [{ id, name: nextEntry.name, arguments: args }] }
  }
}

export function readLedgerRows(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '')
    .map((l) => { try { return JSON.parse(l) } catch { return { leg: 'unparseable', raw: l.slice(0, 120) } } })
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms) })

function makeWorldSkeleton({ world, suite }) {
  mkdirSync(join(world, 'profiles', 'web'), { recursive: true })
  for (const f of PLUGIN_FILES) copyFileSync(join(HERE, f), join(world, 'profiles', 'web', f))
  const work = join(world, 'work')
  for (const d of ['w', 'data', 'search', 'askdir', 'denydir', 'out']) mkdirSync(join(work, d), { recursive: true })
  writeFileSync(join(work, 'data', 'note.txt'), 'G1FDATA1-note-content-line\n')
  writeFileSync(join(work, 'search', 'a.txt'), 'needle here\nline two\nneedle again\n')
  mkdirSync(join(world, 'mcpmarks'), { recursive: true })
  if (suite !== 'a') writeFileSync(join(world, 'wake-late-notes.txt'), 'alpha wakes only after runner touches wake-alpha.flag\n')
}

function fsCheck(work, rel) {
  const p = join(work, rel)
  if (!existsSync(p)) return { exists: false }
  return { exists: true, content: readFileSync(p, 'utf8') }
}

export function evaluateOracleA({ ev, work, rows, noTokenStatus, sessionId, promptStatuses }) {
  const by = (leg) => rows.filter((r) => r.leg === leg)
  const bodyStart = (tag) => by('body-start').find((r) => r.tag === tag)
  const bodyEnd = (tag) => by('body-end').find((r) => r.tag === tag)
  const refused = (tag) => by('refused-before-body').find((r) => r.tag === tag)
  const ctl = (action, tag) => by('ctl').find((r) => r.action === action && (tag === undefined || r.tag === tag))
  const grant = (phase, name) => by('grant').find((r) => r.phase === phase && (name === undefined || r.name === name))
  const cells = {}
  const settled = GROUPS_A.every((g) => by('ctl').some((r) => r.action === 'settle' && r.tag === g.name))
  // enroll: all 8 families ok
  const enroll = by('enroll')[0]
  cells.enroll8 = { pass: enroll !== undefined && Array.isArray(enroll.results) && enroll.results.length === 8 && enroll.results.every((r) => r.ok === true), detail: JSON.stringify(enroll?.results ?? []).slice(0, 220) }
  // PoC-1
  const w1 = fsCheck(work, 'w/ok.txt')
  cells.p1_write_allow = { pass: w1.exists && ['G1F-EDITED', 'G1F-OK'].includes(w1.content) && bodyEnd('p1a')?.ok === true, detail: `ok.txt=${JSON.stringify(w1.content ?? null)}` }
  cells.p1_write_deny_zero_effect = { pass: fsCheck(work, 'out/bad.txt').exists === false && refused('p1d')?.decision === 'refused' && bodyStart('p1d') === undefined, detail: `refused=${JSON.stringify(refused('p1d')?.decision ?? null)} file-absent=${String(!fsCheck(work, 'out/bad.txt').exists)}` }
  cells.p1_edit = { pass: w1.content === 'G1F-EDITED' && bodyEnd('p1e')?.ok === true, detail: `content=${JSON.stringify(w1.content ?? null)}` }
  const collision = by('family-register').find((r) => r.reason === 'name-collision' && r.name === 'write' && r.by === 'P1-DUPE-WRITE2')
  const ownerKept = (by('ctl').find((r) => r.action === 'status' && r.tag === 'after-p1')?.detail ?? '').includes('P1-B-WRITE')
  cells.p1_collision_refused = { pass: collision !== undefined && ctl('dupe-attempt')?.ok === true && ownerKept, detail: `collision-row=${collision !== undefined}; dupe-attempt-ctl-ok=${String(ctl('dupe-attempt')?.ok)}; owner-kept=${String(ownerKept)}` }
  const regRows = by('family-register').filter((r) => r.phase === 'registered')
  const shas = new Set(regRows.map((r) => r.registrySelfSha))
  const fams = regRows.filter((r) => ['P1-B-WRITE', 'P1-B-EDIT'].includes(r.family))
  cells.p1_zerodiff_second_family = { pass: fams.length === 2 && shas.size === 1 && regRows.length >= 8, detail: `registered=${String(regRows.length)}; distinct-registry-sha=${String(shas.size)}; write+edit present=${String(fams.length === 2)}` }
  // PoC-2
  const readMark = existsSync(join(ev.markerDir, 'read-p2a.first8')) ? readFileSync(join(ev.markerDir, 'read-p2a.first8'), 'utf8').trim() : ''
  cells.p2_read_allow = { pass: readMark === 'G1FDATA1' && bodyEnd('p2a')?.ok === true, detail: `marker.first8=${JSON.stringify(readMark)}` }
  cells.p2_read_deny = { pass: refused('p2d')?.decision === 'refused' && bodyStart('p2d') === undefined, detail: `decision=${JSON.stringify(refused('p2d')?.decision ?? null)}` }
  const grepCount = existsSync(join(ev.markerDir, 'grep-p2g2.count')) ? readFileSync(join(ev.markerDir, 'grep-p2g2.count'), 'utf8').trim() : ''
  cells.p2_grep_ask_consume = { pass: grant('requested', 'grep') !== undefined && grant('approved', 'grep') !== undefined && grant('consumed', 'grep') !== undefined && /matches=[2-9]/.test(grepCount) && bodyStart('p2g2') !== undefined, detail: `grep-marker=${JSON.stringify(grepCount)}; phases=${by('grant').filter((r) => r.name === 'grep').map((r) => r.phase).join(',')}` }
  cells.p2_grep_replay_refused = { pass: grant('replay-refused', 'grep') !== undefined && refused('p2g3')?.decision === 'replay-refused' && bodyStart('p2g3') === undefined, detail: `g3-refused=${JSON.stringify(refused('p2g3')?.decision ?? null)}; body=${bodyStart('p2g3') === undefined ? 'zero' : 'PRESENT!'}` }
  cells.p2_bash_deny_zero_process = { pass: fsCheck(work, 'denydir/x.txt').exists === false && refused('p2bd')?.decision === 'refused' && bodyStart('p2bd') === undefined, detail: `denydir/x.txt-absent=${String(!fsCheck(work, 'denydir/x.txt').exists)}; decision=${JSON.stringify(refused('p2bd')?.decision ?? null)}` }
  const askF = fsCheck(work, 'askdir/y.txt')
  cells.p2_bash_ask_consume = { pass: askF.exists && askF.content.trim() === 'askok' && bodyStart('p2q2') !== undefined && bodyStart('p2q') === undefined, detail: `askdir/y.txt=${JSON.stringify(askF.content ?? null)}` }
  cells.p2_bash_revoke_before_body = { pass: fsCheck(work, 'askdir/z.txt').exists === false && grant('revoked', 'bash') !== undefined && refused('p2r2')?.decision === 'revoked-refused' && bodyStart('p2r2') === undefined, detail: `z.txt-absent=${String(!fsCheck(work, 'askdir/z.txt').exists)}; decision=${JSON.stringify(refused('p2r2')?.decision ?? null)}` }
  cells.p2_bash_allow = { pass: fsCheck(work, 'w/shell.txt').exists && bodyEnd('p2w')?.ok === true, detail: `shell.txt=${JSON.stringify(fsCheck(work, 'w/shell.txt').content ?? null)}` }
  // ONE ledger instance serves EVERY class: every decision row (admit AND
  // grant state-machine rows) carries the minting ledger's instanceId.
  const ledgerRows = rows.filter((r) => typeof r.ledger === 'string' && ['admit', 'grant', 'policy'].includes(r.leg))
  const ledgers = new Set(ledgerRows.map((r) => r.ledger))
  const ledgerNames = new Set(ledgerRows.filter((r) => ['admit', 'grant'].includes(r.leg)).map((r) => String(r.name)))
  const jobAdmits = by('admit').filter((r) => String(r.name).startsWith('job_'))
  cells.p2_one_ledger_all_classes = { pass: ledgers.size === 1 && ['write', 'edit', 'read', 'grep', 'bash'].every((n) => ledgerNames.has(n)) && jobAdmits.length >= 3, detail: `distinct-ledger-instances=${String(ledgers.size)} (${[...ledgers].join(',')}); names=${JSON.stringify([...ledgerNames])}; job-admits=${String(jobAdmits.length)}` }
  // CI-03 mechanism control: native tools ran BEFORE enrollment (zero
  // mounts, zero governed rows, real native file effects). Shared-agent
  // disclosure: a second session is NOT a second scope on this pin (E2
  // evidence: its rows carry the first session's agent id) — README §CI-03.
  const natW1 = fsCheck(work, 'w/native-write.txt')
  const natW2 = fsCheck(work, 'w/native-write2.txt')
  const preStatus = by('ctl').find((r) => r.action === 'status' && r.tag === 'pre-enroll')
  let preEmpty = false
  try { const s = JSON.parse(preStatus?.detail ?? '{}'); preEmpty = (s.approved ?? []).length === 0 && (s.enrolled ?? []).length === 0 } catch { /* fail cell */ }
  const rowsBeforeEnroll = rows.slice(0, Math.max(0, rows.findIndex((r) => r.leg === 'enroll')))
  const governedBeforeEnroll = rowsBeforeEnroll.filter((r) => ['body-start', 'guard', 'admit'].includes(r.leg)).length
  const preTagged = rows.filter((r) => ['pre1', 'pre2', 'x02', 'x03'].includes(String(r.tag ?? ''))).length
  cells.ci03_pre_enroll_native = { pass: natW1.exists && natW1.content === 'NATIVE-WRITE' && natW2.exists && natW2.content === 'NATIVE-WRITE-2' && preEmpty && governedBeforeEnroll === 0 && preTagged === 0, detail: `native files=${String(natW1.exists)}/${String(natW2.exists)}; center-empty-at-A0=${String(preEmpty)}; governed-rows-before-enroll=${String(governedBeforeEnroll)}; governed-rows-tagged-pre=${String(preTagged)}` }
  // PoC-3
  const born = bodyEnd('p3s')
  cells.p3_job_born_real_process = { pass: born?.job_id !== undefined && fsCheck(work, 'w/jobfile.txt').exists && existsSync(join(ev.markerDir, 'job-spawn-p3s.born')), detail: `job_id=${JSON.stringify(born?.job_id ?? null)}; jobfile=${JSON.stringify(fsCheck(work, 'w/jobfile.txt').content ?? null)}` }
  const listRow = bodyEnd('p3l')
  cells.p3_bridge_list_output = { pass: typeof listRow?.text === 'string' && born?.job_id !== undefined && listRow.text.includes(born.job_id), detail: `job_list text contains born id: ${String(listRow?.text?.slice(0, 80) ?? 'MISSING')}` }
  const outRow = bodyEnd('p3o')
  cells.p3_bridge_output_ring = { pass: typeof outRow?.text === 'string' && outRow.text.includes('JOBOUT-p3s'), detail: `job_output contains real ring bytes: ${JSON.stringify(outRow?.text?.slice(0, 60) ?? 'MISSING')}` }
  const fence = by('bridge').find((r) => r.phase === 'fence-refused')
  const svcKills = JSON.parse(ctl('svc-calls', 'after-fence')?.detail ?? '[]')
  cells.p3_owner_fence_host_nonreach = { pass: fence !== undefined && (Array.isArray(svcKills) ? svcKills.filter((s) => s.method === 'kill' && s.jobId === born?.job_id).length === 0 : false), detail: `fence-row=${fence !== undefined ? 'present' : 'MISSING'}; svc.kill calls for born job=${String(Array.isArray(svcKills) ? svcKills.filter((s) => s.method === 'kill' && s.jobId === born?.job_id).length : -1)}` }
  const mountRows = by('mount-dispose')
  cells.p3_old_disposer_keeps_new_mount = { pass: mountRows.some((r) => r.phase === 'refused-stale' && r.name === 'job_list') && bodyEnd('p3r2') !== undefined && bodyEnd('p3r3') !== undefined, detail: `rows=${JSON.stringify(mountRows.map((r) => `${r.phase}:${r.name}`))}` }
  const grantNames = new Set(by('grant').map((r) => r.name))
  cells.p3_no_second_ledger = { pass: ![...grantNames].some((n) => String(n).startsWith('job_')) && by('bridge').length > 0, detail: `grant-names=${JSON.stringify([...grantNames])}; bridge-rows=${String(by('bridge').length)}` }
  // plants (MUST observe the forbidden effect)
  cells.plant1_path_guard = { pass: fsCheck(work, 'out/plant.txt').exists && fsCheck(work, 'out/plant.txt').content === 'PLANT-P1' && bodyStart('p1pl') !== undefined, detail: `out/plant.txt=${String(fsCheck(work, 'out/plant.txt').exists)}` }
  cells.plant2_ledger_off = { pass: fsCheck(work, 'denydir/p.txt').exists && bodyStart('p2pl') !== undefined, detail: `denydir/p.txt=${String(fsCheck(work, 'denydir/p.txt').exists)}` }
  const afterNaive = by('mount-dispose').some((r) => r.phase === 'PLANT-naive' && r.name === 'job_list')
  let finalApproved = []
  try { finalApproved = JSON.parse(ctl('status', 'final')?.detail ?? '{}').approved ?? [] } catch { /* cell fails */ }
  const naiveRemovedGoverned = Array.isArray(finalApproved) && !finalApproved.includes('job_list')
  cells.plant3_naive_disposer_kills_new_mount = { pass: afterNaive && bodyStart('p3p4') === undefined && naiveRemovedGoverned, detail: `naive-row=${String(afterNaive)}; governed body for p3p4=${bodyStart('p3p4') === undefined ? 'zero (native took over — mount gone)' : 'STILL PRESENT'}; approved-without-job_list=${String(naiveRemovedGoverned)}` }
  cells.protocol = { pass: noTokenStatus === 401 && typeof sessionId === 'string' && promptStatuses.length === GROUPS_A.length && promptStatuses.every((s) => s === 200), detail: `401=${String(noTokenStatus)}; prompts=${String(promptStatuses.join(','))}` }
  const gating = Object.entries(cells)
  const pass = settled && gating.every(([, c]) => c.pass === true)
  return { pass, settled, outcome: !settled ? 'pending' : pass ? 'ALL-G1F-CELLS-PASS' : 'G1F-CELL-FAIL', counts: { rows: rows.length, bodyStarts: by('body-start').length, vetoes: by('guard').filter((r) => r.phase === 'veto').length, plants: by('plant').length }, cells }
}

export function evaluateOracleB({ ev, world, rows, noTokenStatus, sessionId, promptStatuses, lateDiscoveryRow, sessionStampRow }) {
  const by = (leg) => rows.filter((r) => r.leg === leg)
  const mcpServed = (name, msg) => existsSync(join(world, 'mcpmarks', `mcp-${name}-${msg}.served`))
  const refusedB = (tag) => by('refused-before-body').find((r) => r.tag === tag)
  const bodyEnd = (tag) => by('mcp-guard').find((r) => r.phase === 'settled' && r.tag === tag)
  const cells = {}
  const settled = GROUPS_B.every((g) => by('ctl').some((r) => r.action === 'settle' && r.tag === g.name))
  cells.b_late_binding = { pass: lateDiscoveryRow !== undefined && sessionStampRow !== undefined && Date.parse(lateDiscoveryRow.at) > Date.parse(sessionStampRow.at) && lateDiscoveryRow.afterSessionCreated === true, detail: `alpha discovered after ctl session-created stamp: ${JSON.stringify(lateDiscoveryRow ?? null).slice(0, 140)}` }
  cells.b_unknown_refused_before_body = { pass: String(refusedB('b1')?.reason ?? '').startsWith('unknown-dynamic-source') && mcpServed('alpha', 'b1') === false, detail: `b1 refused=${JSON.stringify(refusedB('b1')?.reason ?? null)}; alpha marker b1 absent=${String(!mcpServed('alpha', 'b1'))}` }
  cells.b_admitted_runs = { pass: mcpServed('alpha', 'b2') === true && bodyEnd('b2') !== undefined, detail: `alpha served b2 server-side=${String(mcpServed('alpha', 'b2'))}` }
  cells.b_second_server_no_inherit = { pass: refusedB('b3')?.reason === 'unknown-dynamic-source' && mcpServed('beta', 'b3') === false, detail: `beta(b3) refused=${JSON.stringify(refusedB('b3')?.reason ?? null)}; beta marker b3 absent=${String(!mcpServed('beta', 'b3'))}` }
  cells.b_admitted_beta_runs = { pass: mcpServed('beta', 'b4') === true, detail: `beta served b4 server-side=${String(mcpServed('beta', 'b4'))}` }
  cells.b_plant_admission_off = { pass: by('mcp-guard').some((r) => r.phase === 'PLANT-admission-disabled') && mcpServed('beta', 'b5') === true, detail: `plant row + beta served b5=${String(mcpServed('beta', 'b5'))}` }
  cells.b_after_heal_refused = { pass: refusedB('b6')?.reason === 'unknown-dynamic-source' && mcpServed('beta', 'b6') === false, detail: `b6 refused again=${JSON.stringify(refusedB('b6')?.reason ?? null)}; marker b6 absent=${String(!mcpServed('beta', 'b6'))}` }
  cells.protocol = { pass: noTokenStatus === 401 && typeof sessionId === 'string' && promptStatuses.length === GROUPS_B.length && promptStatuses.every((s) => s === 200), detail: `401=${String(noTokenStatus)}; prompts=${String(promptStatuses.join(','))}` }
  const pass = settled && Object.values(cells).every((c) => c.pass === true)
  return { pass, settled, outcome: !settled ? 'pending' : pass ? 'ALL-G1F-B-CELLS-PASS' : 'G1F-B-CELL-FAIL', counts: { rows: rows.length, discovered: by('mcp-watch').filter((r) => r.phase === 'discovered').length, admitted: by('mcp-admit').length }, cells }
}

export async function runOnceG1F({ port, worldName, suite }) {
  const world = validateInputs({ port, worldName })
  const runDir = join(HERE, 'runs', worldName)
  const ev = { runDir, markerDir: join(runDir, 'markers'), ledger: join(runDir, 'ledger.jsonl'), steps: join(runDir, 'steps.jsonl'), summary: join(runDir, 'summary.json') }
  const deadline = Date.now() + RUN_BUDGET_MS
  const remaining = () => deadline - Date.now()
  const runAbort = new AbortController()
  let timedOut = false; let instance; let hostChild; let mock; let token; let oracle; let failed = false; let runError
  let sessionId; let noTokenStatus; const promptStatuses = []
  const recordStep = (step, status, detail) => {
    mkdirSync(runDir, { recursive: true })
    const safe = detail === undefined ? undefined : JSON.parse(scrubSecrets(JSON.stringify(detail), token))
    appendFileSync(ev.steps, JSON.stringify({ at: new Date().toISOString(), step, status, ...(safe !== undefined ? { detail: safe } : {}), budget_left_ms: remaining() }) + '\n')
  }
  const watchdog = setTimeout(() => {
    timedOut = true; failed = true
    try { recordStep('watchdog', 'fail', { reason: 'budget exhausted' }) } catch { /* dir may not exist */ }
    runAbort.abort(new Error('TIMEOUT'))
    if (hostChild !== undefined && hostChild.exitCode === null && hostChild.signalCode === null) { try { hostChild.kill('SIGKILL') } catch { /* re-verified in finally */ } }
  }, RUN_BUDGET_MS).unref()
  const work = join(world, 'work')
  try {
    for (const c of preflight({ port, suite })) { recordStep('preflight', c.ok ? 'ok' : 'fail', c); if (!c.ok) throw new Error(`preflight failed: ${c.check} — ${String(c.detail)}`) }
    makeWorldSkeleton({ world, suite })
    recordStep('world-skeleton', 'ok', { world })
    instance = new DshInstance({ hostTree: HTU, dshHome: world, port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: runDir })
    writeFileSync(instance.patchFile, buildPatchText({ suite, world }))
    recordStep('patch', 'ok', { sha256: sha256File(instance.patchFile) })
    mkdirSync(ev.markerDir, { recursive: true })
    recordStep('env-scrub', 'ok', { removed_keys: scrubProviderEnv() })
    process.env.DEEPSEEK_BASE_URL = 'http://127.0.0.1:__PORT__'
    process.env.DEEPSEEK_API_KEY = FAKE_KEY
    process.env.G1F_LEDGER = ev.ledger
    process.env.G1F_MARKER_DIR = ev.markerDir
    process.env.G1F_WORK_ROOT = work
    process.env.G1F_MASTER_REPO = REPO
    const groups = SUITE_GROUPS[suite]
    const decide = makeDecideG1F({ ledgerPath: ev.ledger, groups, marker: SUITE_MARKER[suite], onProbe: (p) => recordStep('wire-probe', 'info', p) })
    mock = await startMockModel({
      port: 0,
      decide: async (req) => decide(req),
      log: (m) => recordStep('mock', 'info', m),
      fixtures: {
        dir: join(runDir, 'wire'), limit: 48, maxTextLength: 2400,
        select: (record, parsed) => (JSON.stringify(parsed?.messages ?? '').includes(SUITE_MARKER[suite]) ? `probe-req-${String(record.method ?? 'post')}` : null),
      },
    })
    process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
    recordStep('mock-listen', 'ok', { port: mock.port })
    const startPromise = instance.start({ timeoutMs: Math.min(BOOT_TIMEOUT_MS, remaining()) })
    hostChild = instance.child
    const booted = await startPromise
    token = new URL(booted.url).searchParams.get('token') ?? undefined
    recordStep('host-boot', 'ok', { owned_pid: hostChild?.pid ?? null, token_fingerprint: token === undefined ? 'absent' : createHash('sha256').update(token).digest('hex').slice(0, 8) })
    const origin = `http://127.0.0.1:${port}`
    noTokenStatus = await probeNoToken(origin)
    recordStep('token-gate', noTokenStatus === 401 ? 'ok' : 'fail', { status: noTokenStatus })
    if (noTokenStatus !== 401) throw new Error(`token gate: expected 401, got ${String(noTokenStatus)}`)
    const cookie = await authenticate(origin, token, runAbort.signal)
    recordStep('authenticate', 'ok')
    const createRes = await apiSessionCreate(origin, cookie, work, 'g1fb', runAbort.signal)
    if (createRes.status !== 200) throw new Error(`session/create returned ${String(createRes.status)}`)
    sessionId = JSON.stringify(createRes.body).match(/"sessionId":"([^"]+)"/)?.[1]
    if (typeof sessionId !== 'string') throw new Error('sessionId absent')
    recordStep('session-create', 'ok', { id: sessionId })
    for (const group of groups) {
      if ((suite === 'b' || suite === 'ab') && group.name === 'B1-late-bind') {
        // late binding: wake alpha AFTER the session exists, then wait for the
        // discovery row (the late-binding evidence itself)
        writeFileSync(join(world, 'wake-alpha.flag'), `woke at ${new Date().toISOString()}\n`)
        recordStep('wake-alpha', 'ok')
        const until = Date.now() + 40_000
        let discovered
        for (;;) {
          discovered = readLedgerRows(ev.ledger).find((r) => r.leg === 'mcp-watch' && r.phase === 'discovered' && r.name === 'mcp__alpha__ping')
          if (discovered !== undefined || Date.now() >= until || remaining() <= 0) break
          await sleep(250)
        }
        recordStep('late-binding', discovered !== undefined ? 'ok' : 'fail', { row: discovered ?? null })
        if (discovered === undefined) throw new Error('mcp__alpha__ping never appeared after wake')
      }
      const sid = sessionId
      const markerHere = SUITE_MARKER[suite]
      const res = await apiPrompt(origin, cookie, sid, `g1fb ${worldName} ${group.name} ${markerHere}`, `gf-${group.name}`, runAbort.signal)
      promptStatuses.push(res.status)
      recordStep('prompt', res.status === 200 ? 'ok' : 'fail', { group: group.name, session: group.session, status: res.status })
      if (res.status !== 200) throw new Error(`prompt ${group.name} returned ${String(res.status)}`)
      const waitUntil = Date.now() + Math.min(GROUP_WAIT_MS, Math.max(1, remaining()))
      let done = false
      for (;;) {
        const rows = readLedgerRows(ev.ledger)
        if (rows.some((r) => r.leg === 'ctl' && r.action === 'settle' && r.tag === group.name)) { done = true; break }
        if (Date.now() >= waitUntil || remaining() <= 0) break
        await sleep(400)
      }
      recordStep('group', done ? 'ok' : 'fail', { group: group.name, settled: done })
      if (!done) throw new Error(`group ${group.name} not settled within bound`)
    }
    const rows = readLedgerRows(ev.ledger)
    const lateDiscoveryRow = rows.find((r) => r.leg === 'mcp-watch' && r.phase === 'discovered' && r.name === 'mcp__alpha__ping')
    const sessionStampRow = rows.find((r) => r.leg === 'ctl' && r.action === 'session-created')
    if (suite === 'a') {
      oracle = evaluateOracleA({ ev, work, rows, noTokenStatus, sessionId, promptStatuses })
    } else if (suite === 'b') {
      oracle = evaluateOracleB({ ev, world, rows, noTokenStatus, sessionId, promptStatuses, lateDiscoveryRow, sessionStampRow })
    } else {
      const a = evaluateOracleA({ ev, work, rows, noTokenStatus, sessionId, promptStatuses })
      const b = evaluateOracleB({ ev, world, rows, noTokenStatus, sessionId, promptStatuses, lateDiscoveryRow, sessionStampRow })
      const cells = { ...a.cells, ...b.cells }
      cells.protocol = { pass: noTokenStatus === 401 && typeof sessionId === 'string' && promptStatuses.length === GROUPS_AB.length && promptStatuses.every((s) => s === 200), detail: `401=${String(noTokenStatus)}; prompts=${String(promptStatuses.join(','))} of ${String(GROUPS_AB.length)}` }
      const settled = a.settled && b.settled
      const pass = settled && Object.values(cells).every((c) => c.pass === true)
      oracle = { pass, settled, outcome: !settled ? 'pending' : pass ? 'ALL-G1F-AB-CELLS-PASS' : 'G1F-AB-CELL-FAIL', counts: { rows: rows.length, a: a.counts, b: b.counts }, cells }
    }
    recordStep('oracle', oracle.pass ? 'ok' : 'fail', { outcome: oracle.outcome, counts: oracle.counts })
    if (!oracle.pass) failed = true
  } catch (error) {
    failed = true
    runError = scrubSecrets(String(error?.message ?? error), token)
    recordStep('run', 'fail', { error: runError })
  } finally {
    clearTimeout(watchdog)
    if (runAbort.signal.aborted || timedOut) failed = true
    if (instance !== undefined) {
      try { const stopped = await instance.stop({ timeoutMs: 15_000 }); recordStep('teardown-host', 'ok', stopped) } catch (e) { failed = true; recordStep('teardown-host', 'fail', { error: scrubSecrets(String(e?.message ?? e), token) }) }
      if (hostChild !== undefined && hostChild.exitCode === null && hostChild.signalCode === null) {
        failed = true
        try { hostChild.kill('SIGKILL') } catch { /* recorded below */ }
        const gone = await Promise.race([new Promise((res) => hostChild.once('close', () => res(true))), sleep(15_000).then(() => false)])
        recordStep('teardown-host-kill', gone ? 'ok' : 'fail', { reason: 'owned child SIGKILL requested', reaped: gone })
      }
    }
    if (mock !== undefined) { try { await mock.close(); recordStep('teardown-mock', 'ok') } catch (e) { failed = true; recordStep('teardown-mock', 'fail', { error: String(e?.message ?? e) }) } }
    if (instance !== undefined && existsSync(instance.logPath)) {
      try { writeFileSync(`${instance.logPath}.redacted`, scrubSecrets(readFileSync(instance.logPath, 'utf8'), token)) } catch { /* evidence hygiene */ }
    }
    const gitAfter = { head: spawnSync('git', ['-C', HTU, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim(), porcelain: spawnSync('git', ['-C', HTU, 'status', '--porcelain'], { encoding: 'utf8' }).stdout }
    recordStep('post-check-htu', gitAfter.head === HTU_PIN && (gitAfter.porcelain ?? '') === '' ? 'ok' : 'fail', { head: gitAfter.head?.slice(0, 12), porcelain: (gitAfter.porcelain ?? '').slice(0, 200) })
    writeFileSync(ev.summary, JSON.stringify({ worldName, suite, port, owned_pid: hostChild?.pid ?? null, run_error: runError ?? null, pass: !failed && oracle?.pass === true, timed_out: timedOut, budget_ms: RUN_BUDGET_MS, used_ms: RUN_BUDGET_MS - Math.max(0, remaining()), budget: { host_starts: 1 }, oracle }, null, 2) + '\n')
  }
  return { pass: !failed && oracle?.pass === true, oracle, runDir }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2)
  const go = args.includes('--go')
  const portIdx = args.indexOf('--port')
  const port = portIdx >= 0 ? Number(args[portIdx + 1]) : SANCTIONED_PORT
  const suite = args.includes('--suite') ? args[args.indexOf('--suite') + 1] : 'a'
  const worldName = `${WORLD_PREFIX}${utcStamp()}`
  if (!go) {
    console.log('== G1F-SUP-B DRY RUN (read-only; zero spawn, zero world writes) ==')
    let allOk = true
    for (const c of preflight({ port, suite })) { if (!c.ok) allOk = false; console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.check} (${String(c.detail).slice(0, 120)})`) }
    console.log(`suite=${suite} groups=${String((SUITE_GROUPS[suite] ?? []).length)} world=tests/homes/${worldName} port=${String(port)}`)
    process.exit(allOk ? 0 : 1)
  }
  const out = await runOnceG1F({ port, worldName, suite })
  console.log(JSON.stringify({ pass: out.pass, outcome: out.oracle?.outcome, counts: out.oracle?.counts, cells: Object.fromEntries(Object.entries(out.oracle?.cells ?? {}).map(([k, v]) => [k, { pass: v.pass, detail: String(v.detail).slice(0, 200) }])) }, null, 2))
  process.exit(out.pass ? 0 : 1)
}
