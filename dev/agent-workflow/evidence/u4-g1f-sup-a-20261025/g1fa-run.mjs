/**
 * G1F-SUP-A runner — ONE bounded Host run covering: (A) the H0 matrix re-run
 * under the next()-passing guard redesign (cells a–f incl. the guard-off
 * sensitivity plant), (B) the Host-equivalence suite (pre-aborted caller
 * signal, cancel-during-body, signal fuse/restore, in-guard-window swap,
 * post-execute value replacement / parity swap / divergent swap / block,
 * finalize/project capture, executionMode race, nested parent dispatch +/-),
 * (C) PoC-5 late-registrant negative + explicit-bind positive, (D) PoC-6
 * agent-control negatives (governed) + native positives (non-governed second
 * session) with zero-effect oracles (wire-grep + profile-tree hash).
 *
 * Fixed oracle classes per cell (review round-1 requirement 2): `legsOkFor`
 * requires the EXPECTED leg rows (exact set, each ok) — never `>= 0` — and
 * every cell asserts the exact settlement class from `tools/result` rows
 * (error.info.code) + the ctl equiv rows.
 *
 * Budget: 1 Host start here (2nd reserved for a root-caused fixture re-run).
 * Port 3185 only; :3080 and ~/.dsh forbidden; world tests/homes/g1fa-<UTC>.
 * @module dev/agent-workflow/evidence/u4-g1f-sup-a-20261025/g1fa-run
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DshInstance } from './instance.mjs'
import { portInUse, waitForPortFree } from './util.mjs'
import { startMockModel } from './mock-deepseek.mjs'
import { apiPrompt, apiSessionCreate, authenticate, probeNoToken } from './s1m1-session-client.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = resolve(HERE, '..', '..', '..', '..')
export const HTU = join(REPO, 'tests', 'deepseek-harness-test-use')
export const HTU_PIN = '639ed015397290b3745d163aafe02ffee4aa3f84'
export const CLIENT_COMMIT_HASH = '639ed01539'
export const HOST_ENTRY = join(HTU, 'apps', 'cli', 'lib', 'bin.js')
export const FAKE_KEY = 'g1fa-sup-a-mock-key'
export const TEST_PORT_RANGES = Object.freeze([Object.freeze([3180, 3186]), Object.freeze([3491, 3500])])
export const STABLE_INSTANCE_PORT = 3080
export const SANCTIONED_PORT = 3185 // ONLY this port (3186 belongs to G1F-SUP-B)
export const WORLD_PREFIX = 'g1fa-'
export const RUN_BUDGET_MS = 30 * 60_000
export const TEARDOWN_STEP_MS = 15_000
export const BOOT_TIMEOUT_MS = 90_000
export const GROUP_WAIT_MS = 120_000
export const SCRUBBED_ENV_KEYS = Object.freeze([
  'DEEPSEEK_API_KEY', 'DEEPSEEK_SEARCH_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 'MISTRAL_API_KEY', 'AZURE_OPENAI_API_KEY',
])
// Sealed neighbors' bytes must not move (read-only inputs of this package).
export const SEALED = Object.freeze([
  [join(HERE, '..', 'u4-h0-20261025', 'README.md'), 'afb3f7ac73291458a6e1330b0f5ac49757b8c922c539efe7c098c9bd54caeb39'],
  [join(HERE, '..', 'u4-h0-20261025', 'STATIC-TRACE.md'), '68099dd8d3041d963aa175591cb544a321adbc49b18385672c18f962859ae217'],
  [join(HERE, '..', 'u4-h0-20261025', 'u4h0-probe-plugin.mjs'), '2c6d471586d8148ea2ff91b870632ddeeadb89f376a6b4ab99bb6575fd4fc5d0'],
  [join(HERE, '..', 'u4-h0-20261025', 'u4h0-run.mjs'), 'e9585a36c4bfdcd31725c40e294813dcbf7a078cef67ec9ff7611a99b82b1bd4'],
  [join(HERE, '..', 'u4-obligations-20261025', 'feasibility.json'), null], // existence + non-empty only (sealed, sha pinned in its own manifest)
])
export const MOCK_SHA256 = '8beade69588c105efb66df6a7a99dd915cb41b7aba91635ec0ebf73e6278fb06'
const PROMPT_MARKER_T = 'G1FA-PROMPT-T'
const PROMPT_MARKER_N = 'G1FA-PROMPT-N'
const TARGET = 'u4_h0_target'
const CTL = 'u4g1a_ctl'
const LATE_CTL = 'u4g1a_late_ctl'

export const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
export const utcStamp = (d = new Date()) => d.toISOString().replace(/[:]/g, '-').replace(/\.\d+Z$/, 'Z')
export function isSanctionedTestPort(port) {
  if (!Number.isInteger(port) || port === STABLE_INSTANCE_PORT) return false
  return TEST_PORT_RANGES.some(([lo, hi]) => port >= lo && port <= hi)
}
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
  if (!isSanctionedTestPort(port) || port !== SANCTIONED_PORT) throw new Error(`port ${String(port)} rejected (this executor: 3185 ONLY; :3080 forbidden)`)
  if (!worldName.startsWith(WORLD_PREFIX)) throw new Error(`world must start with ${WORLD_PREFIX}`)
  if (basename(worldName) !== worldName || worldName.includes('..')) throw new Error('world must be a single safe basename')
  const world = join(HTU, '..', 'homes', worldName)
  if (existsSync(world)) throw new Error(`world path already exists: ${world}`)
  if (existsSync(`${world}.lock`)) throw new Error(`world lock already exists: ${world}.lock`)
  return world
}

/** Synchronous LISTEN-port snapshot from /proc (M3 precedent — util.portInUse is async). */
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

export function preflight({ port }) {
  const git = (args) => spawnSync('git', ['-C', HTU, ...args], { encoding: 'utf8' }).stdout?.trim() ?? ''
  const checks = [
    { check: 'port-sanctioned-3185-only', ok: port === SANCTIONED_PORT && isSanctionedTestPort(port), detail: String(port) },
    { check: 'port-free-per-proc-net', ok: !procNetPorts().has(port), detail: String(port) },
    { check: 'port-3186-not-mine', ok: true, detail: 'unused by this executor (G1F-SUP-B lane)' },
    { check: 'htu-rev-parse-equals-pin', ok: git(['rev-parse', 'HEAD']) === HTU_PIN, detail: git(['rev-parse', 'HEAD']).slice(0, 12) },
    { check: 'htu-status-porcelain-empty', ok: git(['status', '--porcelain']) === '', detail: git(['status', '--porcelain']).slice(0, 200) },
    { check: 'htu-entry-exists', ok: existsSync(HOST_ENTRY), detail: HOST_ENTRY },
    { check: 'bin-echo-exists', ok: existsSync('/bin/echo'), detail: '/bin/echo' },
    { check: 'mock-copy-bytes', ok: sha256File(join(HERE, 'mock-deepseek.mjs')) === MOCK_SHA256, detail: MOCK_SHA256.slice(0, 12) },
    { check: 'plugin-files-exist', ok: ['g1fa-shared.mjs', 'g1fa-plugin.mjs', 'g1fa-registrant.mjs'].every((f) => existsSync(join(HERE, f))), detail: '3 plugin modules' },
    ...SEALED.map(([p, sha]) => ({ check: `sealed-unchanged:${basename(p)}`, ok: existsSync(p) && (sha === null ? readFileSync(p).length > 0 : sha256File(p) === sha), detail: (sha ?? 'exists') === 'exists' ? 'exists' : sha.slice(0, 12) })),
  ]
  return checks
}

export const PROBE_ROWS = Object.freeze([
  { id: 'g1fa-center', name: './g1fa-plugin.mjs' },
  { id: 'g1fa-registrant', name: './g1fa-registrant.mjs' },
])
export const PATCH_HEADER_LINES = Object.freeze([
  'G1F-SUP-A: two plain plugin rows via the public profile-patch seam (DshInstance.mountRows).',
  'Relative names resolve beside this patch file (app-boot @639ed015). No preset, no Team row.',
])
export const EXT_CONTRIBUTOR_ROWS = [
  '- id: session-log-deepseek',
  '  config:',
  '    enabled: false',
  '- id: plugin-package-inventory-deepseek',
  '  config:',
  '    enabled: false',
  '',
].join('\n')
export function buildPatchText() {
  const header = PATCH_HEADER_LINES.map((l) => `# ${l}`).join('\n')
  const insert = ['- insert:', ...PROBE_ROWS.flatMap((row) => [`    - id: ${row.id}`, `      name: ${JSON.stringify(row.name)}`]), ''].join('\n')
  return `${header}\n${insert}${EXT_CONTRIBUTOR_ROWS}`
}

// ── case script ──────────────────────────────────────────────────────────────────
const T = (id, tag, mode, delayMs = 0) => ({ id, name: TARGET, arguments: { tag, mode, ...(delayMs > 0 ? { delayMs } : {}) } })
const C = (id, action, extra = {}) => ({ id, name: CTL, arguments: { action, ...extra } })
const E = (id, kind) => C(id, 'equiv', { kind })
const H = (id, tag) => C(id, 'heal', { tag })
const R = (id, action, extra = {}) => ({ id, name: LATE_CTL, arguments: { action, ...extra } })
/** arguments fn → resolved at issue time with {sessionIdN} (real cross-agent spoof target). */
const SPOOF = (id, name, argfn) => ({ id, name, arguments: argfn })

export const GROUPS = Object.freeze([
  { name: 'G1', sess: 'T', script: [H('h1', 'G1'), C('c1', 'status'), T('t01', 'a1', 'stable'), C('c2', 'regen-same'), T('t02', 'b1', 'stable'), C('c3', 'settle', { tag: 'G1' })] },
  { name: 'G2', sess: 'T', script: [H('h2', 'G2'), C('c4', 'shadow-on'), T('t03', 'c2', 'stable'), C('c5', 'shadow-off'), T('t04', 'c3', 'stable'), C('c6', 'settle', { tag: 'G2' })] },
  { name: 'G3', sess: 'T', script: [H('h3', 'G3'), C('c7', 'restrict-on'), T('t05', 'd1', 'stable'), C('c8', 'restrict-off'), T('t06', 'd2', 'stable'), C('c9', 'settle', { tag: 'G3' })] },
  { name: 'G4', sess: 'T', script: [H('h4', 'G4'), C('c10', 'arm', { kind: 'shadow-mid', delayMs: 150, autoRestoreMs: 700 }), T('t07', 'c1', 'race', 300), H('c11', 'G4b'), C('c12', 'arm', { kind: 'regen-mid', delayMs: 150 }), T('t08', 'b2', 'race', 300), C('c13', 'settle', { tag: 'G4' })] },
  { name: 'G5', sess: 'T', script: [H('h5', 'G5'), C('c14', 'arm', { kind: 'micro-shadow', autoRestoreMs: 700 }), T('t09', 'e1', 'race', 200), H('c15', 'G5b'), C('c16', 'arm', { kind: 'micro-shadow', autoRestoreMs: 700 }), T('t10', 'e2', 'race', 200), H('c17', 'G5c'), C('c18', 'arm', { kind: 'shadow-mid', delayMs: 150, autoRestoreMs: 700 }), T('t11', 'e3', 'race', 300), C('c19', 'settle', { tag: 'G5' })] },
  { name: 'G6', sess: 'T', script: [H('h6', 'G6'), E('c20', 'eq1'), E('c21', 'eq2'), E('c22', 'eq3'), C('c23', 'settle', { tag: 'G6' })] },
  { name: 'G7', sess: 'T', script: [H('h7', 'G7'), E('c24', 'eq4'), E('c25', 'eq5'), E('c26', 'eq6a'), E('c27', 'eq6b'), E('c28', 'eq7'), C('c29', 'settle', { tag: 'G7' })] },
  { name: 'G8', sess: 'T', script: [H('h8', 'G8'), E('c30', 'fin-eq8'), E('c31', 'eq9'), E('c32', 'eq10'), E('c33', 'eq11'), C('c34', 'settle', { tag: 'G8' })] },
  { name: 'G9', sess: 'T', script: [H('h9', 'G9'), R('c35', 'shadow-add'), T('t12', 'p5a', 'stable'), C('c36', 'bind-late'), T('t13', 'p5b', 'stable'), C('c37', 'unbind-late'), R('c38', 'shadow-remove'), H('c39', 'G9b'), C('c40', 'settle', { tag: 'G9' })] },
  { name: 'G10', sess: 'T', script: [H('h10', 'G10'), C('c41', 'guard-off'), T('t14', 'f1', 'fence-swap'), C('c42', 'guard-on'), T('t15', 'f2', 'stable'), C('c43', 'settle', { tag: 'G10' })] },
  {
    name: 'G11', sess: 'T', script: [
      H('h11', 'G11'), C('c44', 'govern-self'), C('c45', 'ctlguard-on'),
      SPOOF('t16', 'send_message', (ctx) => ({ agent_id: ctx.sessionIdN, message: ctx.spoofMarker })),
      SPOOF('t17', 'interrupt_agent', (ctx) => ({ agent_id: ctx.sessionIdN })),
      { id: 't18', name: 'plugin_manager', arguments: { action: 'install_bundle', target: 'g1fa-evil@0.0.1' } },
      C('c46', 'ctlguard-off'),
      { id: 't19', name: 'send_message', arguments: { agent_id: 'g1fa-bogus-agent', message: 'G1A-PLANT-NATIVE' } },
      C('c47', 'ctlguard-on'), C('c48', 'settle', { tag: 'G11' }),
    ],
  },
  {
    name: 'G12', sess: 'N', script: [
      { id: 'n1', name: 'plugin_manager', arguments: { action: 'list_plugins', limit: 3 } },
      { id: 'n2', name: 'list_agents' },
      { id: 'n3', name: 'send_message', arguments: { agent_id: 'g1fa-bogus-agent', message: 'g1fa-native-probe' } },
      C('n4', 'settle', { tag: 'G12' }),
    ],
  },
])

export const SCRIPT_T = Object.freeze(GROUPS.filter((g) => g.sess === 'T').flatMap((g) => g.script))
export const SCRIPT_N = Object.freeze(GROUPS.filter((g) => g.sess === 'N').flatMap((g) => g.script))

/** decide({seq,req}) with the H0 circuit breakers; routes by the session marker. */
export function makeDecideG1A({ maxRepeat = 8, maxTotal = 500, onProbe = () => {}, sessionIds = {}, spoofMarker = 'G1A-SPOOF' } = {}) {
  const mk = (script, marker) => {
    let lastId; let repeat = 0; let issues = 0
    return (messages) => {
      const answered = (id) => messages.some((m) => {
        if (m?.role === 'tool' && (m.tool_call_id === id || m.toolCallId === id)) return true
        for (const part of Array.isArray(m?.content) ? m.content : []) {
          if (part?.type === 'tool_result' && (part.tool_use_id === id || part.toolCallId === id)) return true
        }
        return false
      })
      const ctx = { sessionIdN: sessionIds.N ?? 'g1fa-session-N', spoofMarker }
      const next = script.find((entry) => !answered(`g1a-${entry.id}`))
      if (next === undefined) return { kind: 'text', content: 'g1a-complete' }
      const id = `g1a-${next.id}`
      repeat = lastId === id ? repeat + 1 : 1
      lastId = id
      issues += 1
      if (repeat > maxRepeat || issues > maxTotal) return { kind: 'text', content: `g1a-circuit-break entry=${next.id} repeat=${String(repeat)} issues=${String(issues)}` }
      const args = typeof next.arguments === 'function' ? next.arguments(ctx) : (next.arguments ?? {})
      return { kind: 'tool-call', toolCalls: [{ id, name: next.name, arguments: args }] }
    }
  }
  const runT = mk(SCRIPT_T, PROMPT_MARKER_T)
  const runN = mk(SCRIPT_N, PROMPT_MARKER_N)
  let probes = 0
  return ({ req }) => {
    const messages = Array.isArray(req?.messages) ? req.messages : []
    const flat = JSON.stringify(messages)
    if (probes < 10) {
      probes += 1
      const toolNames = (Array.isArray(req?.tools) ? req.tools : []).map((t) => t?.function?.name ?? t?.name ?? '?')
      onProbe({ markerT: flat.includes(PROMPT_MARKER_T), markerN: flat.includes(PROMPT_MARKER_N), msgCount: messages.length, toolsCount: toolNames.length, toolsHasTarget: toolNames.includes(TARGET), toolsHasCtl: toolNames.includes(CTL), toolsHasSend: toolNames.includes('send_message'), toolsHasPm: toolNames.includes('plugin_manager'), toolsHasListAgents: toolNames.includes('list_agents'), toolNames: toolNames.slice(0, 64) })
    }
    if (flat.includes(PROMPT_MARKER_N)) return runN(messages)
    if (flat.includes(PROMPT_MARKER_T)) return runT(messages)
    return { kind: 'text', content: 'g1a-idle' }
  }
}

function readLedger(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => { try { return JSON.parse(l) } catch { return { leg: 'unparseable', raw: l.slice(0, 120) } } })
}

/** Recursive (path, sha256) map under root (missing root = empty map). */
export function treeHash(root) {
  const out = new Map()
  if (!existsSync(root)) return out
  const walkDir = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) walkDir(p)
      else if (entry.isFile()) out.set(relative(root, p), sha256File(p))
    }
  }
  walkDir(root)
  return out
}
export const treeDigest = (m) => createHash('sha256').update([...m.entries()].sort().map(([k, v]) => `${v}  ${k}\n`).join('')).digest('hex')

/**
 * ORACLE (fixed BEFORE the run; review requirement 2). Ground truth = ledger
 * rows written from inside the Bodies + marker files + /bin/echo process legs
 * + `tools/result` settlement rows. `legsFor` requires the EXPECTED leg set
 * (never `>= 0`) and every leg row ok; every cell asserts the EXACT
 * settlement class.
 */
export function evaluateG1AOracle({ ev, noTokenStatus, sessionIds, promptStatuses, mock, final = false, spoofMarker = 'G1A-SPOOF', profileHashes = {} }) {
  const rows = readLedger(ev.ledger)
  const by = (leg) => rows.filter((r) => r.leg === leg)
  const bodyStarts = by('body-start')
  const markers = existsSync(ev.markerDir) ? readdirSync(ev.markerDir).sort() : []
  const resultRows = by('result')
  const guard = by('guard')
  const equiv = by('equiv')
  const ctlRows = by('ctl')

  const startFor = (tag, body) => bodyStarts.find((r) => r.tag === tag && (body === undefined || r.body === body))
  const startCount = (tag) => bodyStarts.filter((r) => r.tag === tag).length
  const endFor = (tag, body) => by('body-end').find((r) => r.body === (body ?? 'A') && r.tag === tag)
  const abortFor = (tag) => by('body-abort-observed').some((r) => r.tag === tag)
  const vetoFor = (tag) => guard.find((r) => r.phase === 'veto' && r.tag === tag)
  const settledFor = (tag) => guard.find((r) => r.phase === 'settled' && r.tag === tag)
  const approveFor = (tag) => guard.find((r) => r.phase === 'approve' && r.tag === tag)
  const classFor = (callId) => { const rs = resultRows.filter((r) => r.callId === callId); return rs.length === 0 ? undefined : rs[rs.length - 1] }
  /** Settlement class by TAG (the plugin's tools/result listener carries the guard-set tag). */
  const classForTag = (tag) => { const rs = resultRows.filter((r) => r.tag === tag); return rs.length === 0 ? undefined : rs[rs.length - 1] }
  /** Chain a native-name (PoC-6) call to its settlement row WITHOUT assuming the Host reuses the wire call-id. */
  const ctlRow = (phase, name, argPart = undefined) => by('ctl-guard').find((r) => r.phase === phase && r.name === name && (argPart === undefined || String(r.argHead ?? '').includes(argPart)))
  const classForCtl = (phase, name, argPart) => { const r = ctlRow(phase, name, argPart); return r === undefined ? undefined : classFor(r.callId) }
  const classForName = (name) => { const rs = resultRows.filter((r) => r.name === name); return rs.length === 0 ? undefined : rs[rs.length - 1] }
  const equivFor = (kind) => equiv.find((r) => r.kind === kind)
  const ctlFor = (action, tag) => ctlRows.find((r) => r.action === action && (tag === undefined || r.tag === tag))
  const watchAborted = (tag) => by('change-watch').some((r) => Array.isArray(r.abortedTags) && r.abortedTags.includes(tag))
  /** FIXED legsOk: EXACT expected leg set, each row ok===true. Empty expected = ZERO leg rows. */
  const legsOkFor = (tag, expected) => {
    const legRows = rows.filter((r) => ['leg-read', 'leg-process'].includes(r.leg) && r.tag === tag)
    const got = legRows.map((r) => (r.leg === 'leg-read' ? 'read' : 'process')).sort()
    const want = [...expected].sort()
    return got.length === want.length && got.every((v, i) => v === want[i]) && legRows.every((r) => r.ok === true)
  }
  const markerHas = (name) => markers.includes(name)

  // expected marker set (oracle: side effects that MUST exist + absence of all others)
  const runFull = ['a1', 'b1', 'c3', 'd2', 'f2', 'eq5', 'eq6a', 'eq6b', 'eq7', 'eq10']
  // e1/e2 bodies are prevented BEFORE invocation (see e_races) → they write NO markers.
  const expectedMarkers = [
    ...['a1', 'b1', 'c3', 'd2', 'c1', 'b2', 'e3', 'eq3', 'fin-eq8', 'f2', 'eq5', 'eq6a', 'eq6b', 'eq7', 'eq10'].map((t) => `A-${t}.marker`),
    ...runFull.map((t) => `A-${t}.echo`),
    'A-eq2.marker', 'B-f1.marker', 'B-f1.echo', 'Bp-p5b.marker', 'Bp-p5b.echo',
  ].sort()

  const cells = {}
  const C_ = (name, pass, detail) => { cells[name] = { pass: pass === true, detail: String(detail) } }

  // ── fixture hygiene: every T group opened healed (incl. intra-group heals) ──
  const healTags = ['G1', 'G2', 'G3', 'G4', 'G4b', 'G5', 'G5b', 'G5c', 'G6', 'G7', 'G8', 'G9', 'G9b', 'G10', 'G11']
  C_('fixture_heal', healTags.every((t) => ctlFor('heal', t)?.ok === true), healTags.map((t) => `${t}:${ctlFor('heal', t)?.ok ?? 'missing'}`).join(','))

  // ── (a–f) H0 re-run cells, exact classes ─────────────────────────────────
  C_('a_stable', startFor('a1', 'A') !== undefined && endFor('a1')?.ran === true && legsOkFor('a1', ['read', 'process']) && classForTag('a1')?.code === 'SUCCESS', `ran=${endFor('a1')?.ran};class=${classForTag('a1')?.code}`)
  C_('b_regen_at_rest', ctlFor('regen-same')?.ok === true && startFor('b1', 'A') !== undefined && endFor('b1')?.ran === true && legsOkFor('b1', ['read', 'process']) && classForTag('b1')?.code === 'SUCCESS', `ran=${endFor('b1')?.ran};class=${classForTag('b1')?.code}`)
  C_('c_preguard_veto', vetoFor('c2')?.reason === 'identity-mismatch' && startCount('c2') === 0 && legsOkFor('c2', []) && classForTag('c2')?.code === 'U4_GUARD_VETO', `veto=${vetoFor('c2')?.reason};class=${classForTag('c2')?.code}`)
  C_('c_restore_control', endFor('c3')?.ran === true && legsOkFor('c3', ['read', 'process']) && classForTag('c3')?.code === 'SUCCESS', `ran=${endFor('c3')?.ran};class=${classForTag('c3')?.code}`)
  C_('d_restrict_veto', ctlFor('restrict-on')?.ok === true && vetoFor('d1')?.reason === 'not-visible' && startCount('d1') === 0 && legsOkFor('d1', []) && classForTag('d1')?.code === 'U4_GUARD_VETO', `veto=${vetoFor('d1')?.reason};class=${classForTag('d1')?.code}`)
  C_('d_lift_control', endFor('d2')?.ran === true && legsOkFor('d2', ['read', 'process']) && classForTag('d2')?.code === 'SUCCESS', `ran=${endFor('d2')?.ran};class=${classForTag('d2')?.code}`)
  C_('c1_foreign_midbody', startFor('c1', 'A') !== undefined && abortFor('c1') && legsOkFor('c1', []) && classForTag('c1')?.code === 'ABORTED' && !markerHas('B-c1.marker') && startCount('c1') === 1 && watchAborted('c1'), `abort=${abortFor('c1')};class=${classForTag('c1')?.code};watchAbort=${watchAborted('c1')}`)
  C_('b2_regen_inflight', startFor('b2', 'A') !== undefined && by('center').some((r) => r.kind === 'regen-mid') && startCount('b2') === 1 && !bodyStarts.some((r) => r.tag === 'b2' && r.body === 'B') && classForTag('b2')?.code === 'ABORTED' && legsOkFor('b2', []), `A-only;class=${classForTag('b2')?.code}`)
  // e1/e2: microtask-armed swap lands in the guard→:1578 window; the watcher abort is
  // synchronous pre-dispatch, so the HOST's own abort check prevents body INVOCATION
  // (ABORTED_BEFORE_DISPATCH, zero body rows — strictly stronger than a mid-body abort).
  // e3: timer swap lands mid-body → bodyInvoked true → ABORTED. Both must be B-free.
  C_('e_races', ['e1', 'e2'].every((t) => startCount(t) === 0 && watchAborted(t) && classForTag(t)?.code === 'ABORTED_BEFORE_DISPATCH' && !markerHas(`A-${t}.marker`) && !markerHas(`B-${t}.marker`)) && startFor('e3', 'A') !== undefined && startCount('e3') === 1 && abortFor('e3') && classForTag('e3')?.code === 'ABORTED' && legsOkFor('e3', []) && !markerHas('B-e3.marker'), `e1=${classForTag('e1')?.code},e2=${classForTag('e2')?.code} (prevented pre-dispatch);e3=${classForTag('e3')?.code} (mid-body abort)`)
  const f1Start = startFor('f1', 'B')
  C_('f_plant_executes', f1Start !== undefined && markerHas('B-f1.marker') && markerHas('B-f1.echo') && by('leg-process').some((r) => r.body === 'B' && r.tag === 'f1' && r.ok === true) && guard.some((r) => r.phase === 'disabled-passthrough' && r.tag === 'f1'), `B-ran=${endFor('f1', 'B')?.ran === true};marker+process observed`)
  C_('f_after_restore', endFor('f2')?.ran === true && legsOkFor('f2', ['read', 'process']) && classForTag('f2')?.code === 'SUCCESS', `ran=${endFor('f2')?.ran};class=${classForTag('f2')?.code}`)

  // ── Host-equivalence cells ───────────────────────────────────────────────
  C_('eq1_pre_aborted_signal', equivFor('eq1')?.code === 'ABORTED_BEFORE_DISPATCH' && classFor('g1a-eq1')?.code === 'ABORTED_BEFORE_DISPATCH' && startCount('eq1') === 0 && approveFor('eq1') === undefined && !markerHas('A-eq1.marker'), `equiv=${equivFor('eq1')?.code};result=${classFor('g1a-eq1')?.code};starts=${startCount('eq1')}`)
  C_('eq2_cancel_during_body', startFor('eq2', 'A') !== undefined && abortFor('eq2') && equivFor('eq2')?.code === 'ABORTED' && classFor('g1a-eq2')?.code === 'ABORTED' && legsOkFor('eq2', []), `equiv=${equivFor('eq2')?.code};bodyInvoked-by-body-start+ABORTED(not BEFORE_DISPATCH)`)
  C_('eq3_signal_fuse_restore', startFor('eq3', 'A') !== undefined && abortFor('eq3') && equivFor('eq3')?.code === 'ABORTED' && equivFor('eq3')?.extra?.signalRestored === true && equivFor('eq3')?.extra?.guardPost === 'drift', `code=${equivFor('eq3')?.code};restored=${equivFor('eq3')?.extra?.signalRestored};post=${equivFor('eq3')?.extra?.guardPost}`)
  C_('eq4_swap_in_guard_window', startCount('eq4') === 0 && by('fence2').some((r) => r.phase === 'swapped') && watchAborted('eq4') && equivFor('eq4')?.code === 'ABORTED_BEFORE_DISPATCH' && classFor('g1a-eq4')?.code === 'ABORTED_BEFORE_DISPATCH' && !markerHas('A-eq4.marker') && !markerHas('B-eq4.marker'), `equiv=${equivFor('eq4')?.code};Host :1572 prevented body (watcher abort synchronous pre-dispatch)`)
  C_('eq5_post_value_parity', startFor('eq5', 'A') !== undefined && equivFor('eq5')?.code === 'SUCCESS' && equivFor('eq5')?.extra?.valueNote === 'G1A-VALUE-REPLACED' && legsOkFor('eq5', ['read', 'process']), `valueNote=${equivFor('eq5')?.extra?.valueNote}`)
  C_('eq6a_post_value_swapped_parity', startFor('eq6a', 'A') !== undefined && equivFor('eq6a')?.code === 'SUCCESS' && String(equivFor('eq6a')?.extra?.contentHead ?? '').startsWith('B-render:') && by('swap').some((r) => r.label === 'post-eq6a-restored' && r.ok === true), `content=${equivFor('eq6a')?.extra?.contentHead};then-live swapped definition validated+rendered (parity)`)
  C_('eq6b_post_value_divergent', startFor('eq6b', 'A') !== undefined && equivFor('eq6b')?.code === 'INVALID_TOOL_OUTPUT' && startCount('eq6b') === 1 && !bodyStarts.some((r) => r.body === 'Bdiv') && by('swap').some((r) => r.label === 'post-eq6b-restored' && r.ok === true), `code=${equivFor('eq6b')?.code};Bdiv body never ran`)
  C_('eq7_post_block', startFor('eq7', 'A') !== undefined && equivFor('eq7')?.code === 'ERROR' && String(equivFor('eq7')?.extra?.msgHead ?? '').includes('G1A-POST-BLOCKED'), `msg=${equivFor('eq7')?.extra?.msgHead}`)
  C_('eq8_finalize_project_capture', startFor('fin-eq8', 'A') !== undefined && by('leg-finalize').some((r) => r.tag === 'fin-eq8' && r.body === 'A') && by('leg-project').some((r) => r.tag === 'fin-eq8' && r.body === 'A') && !by('leg-finalize').some((r) => r.tag === 'fin-eq8' && r.body === 'B') && !by('leg-project').some((r) => r.tag === 'fin-eq8' && r.body === 'B') && String(equivFor('fin-eq8')?.extra?.contentHead ?? '').startsWith('FINALIZED-BY-A') && classFor('g1a-fin-eq8')?.code === 'ABORTED', `finalize/project=A;content=${equivFor('fin-eq8')?.extra?.contentHead};class=${classFor('g1a-fin-eq8')?.code}`)
  C_('eq9_execmode_race_failclosed', equivFor('eq9')?.extra?.modeBefore === 'parallel' && equivFor('eq9')?.extra?.modeAfterSwap === 'exclusive' && equivFor('eq9')?.code === 'U4_GUARD_VETO' && startCount('eq9') === 0 && by('swap').some((r) => r.label === 'eq9-restored' && r.ok === true), `before=${equivFor('eq9')?.extra?.modeBefore};after=${equivFor('eq9')?.extra?.modeAfterSwap};dispatch=${equivFor('eq9')?.code}`)
  C_('eq10_nested_approved', approveFor('eq10')?.nested === true && startFor('eq10', 'A')?.nested === true && equivFor('eq10')?.code === 'SUCCESS' && classFor('g1a-eq10-inner')?.code === 'SUCCESS' && legsOkFor('eq10', ['read', 'process']), `guard-nested=${approveFor('eq10')?.nested};body-nested=${startFor('eq10', 'A')?.nested};class=${classFor('g1a-eq10-inner')?.code}`)
  C_('eq11_nested_veto', vetoFor('eq11')?.nested === true && startCount('eq11') === 0 && equivFor('eq11')?.code === 'U4_GUARD_VETO' && by('swap').some((r) => r.label === 'eq11-restored' && r.ok === true), `veto-nested=${vetoFor('eq11')?.nested};dispatch=${equivFor('eq11')?.code}`)

  // ── PoC-5: late registrant (not in the approval table) ───────────────────
  C_('p5a_late_shadow_veto', by('registrant').some((r) => r.action === 'shadow-add' && r.ok === true) && vetoFor('p5a')?.reason === 'identity-mismatch' && startCount('p5a') === 0 && startCount('p5b') === 1 && !markerHas('Bp-p5a.marker') && classForTag('p5a')?.code === 'U4_GUARD_VETO', `veto=${vetoFor('p5a')?.reason};Bp-runs=${bodyStarts.filter((r) => r.body === 'Bp').length}`)
  C_('p5b_explicit_bind_runs', ctlFor('bind-late')?.ok === true && startFor('p5b', 'Bp') !== undefined && by('grant-ok').some((r) => r.body === 'Bp' && r.tag === 'p5b') && legsOkFor('p5b', ['read', 'process']) && markerHas('Bp-p5b.marker') && classForTag('p5b')?.code === 'SUCCESS', `Bp executed ONLY after center-table bind;class=${classForTag('p5b')?.code}`)

  // ── PoC-6: agent-control negatives (governed) + native positives (non-governed) ──
  C_('p6_send_message_veto', ctlRow('veto', 'send_message') !== undefined && classForCtl('veto', 'send_message')?.code === 'U4_GUARD_VETO' && String(classForCtl('veto', 'send_message')?.reason ?? '') === 'agent-control-deny', `class=${classForCtl('veto', 'send_message')?.code}:${classForCtl('veto', 'send_message')?.reason}`)
  C_('p6_interrupt_agent_veto', ctlRow('veto', 'interrupt_agent') !== undefined && classForCtl('veto', 'interrupt_agent')?.code === 'U4_GUARD_VETO', `class=${classForCtl('veto', 'interrupt_agent')?.code}`)
  C_('p6_plugin_manager_veto', ctlRow('veto', 'plugin_manager') !== undefined && classForCtl('veto', 'plugin_manager')?.code === 'U4_GUARD_VETO', `class=${classForCtl('veto', 'plugin_manager')?.code}`)
  C_('p6_plant_native_when_guard_off', ctlRow('passthrough-native', 'send_message', 'G1A-PLANT-NATIVE') !== undefined && classForCtl('passthrough-native', 'send_message', 'G1A-PLANT-NATIVE') !== undefined && classForCtl('passthrough-native', 'send_message', 'G1A-PLANT-NATIVE')?.code !== 'U4_GUARD_VETO', `plant class=${classForCtl('passthrough-native', 'send_message', 'G1A-PLANT-NATIVE')?.code} (native body ran; the veto above is the guard, not native validation)`)
  C_('p6_spoof_zero_effects', (() => {
    const leaked = (mock?.requests ?? []).filter((r) => {
      const body = JSON.stringify(r?.body ?? {})
      return body.includes(spoofMarker) && body.includes(PROMPT_MARKER_N)
    })
    return leaked.length === 0
  })(), 'no mock request of session N carries the spoof payload (message never delivered)')
  C_('p6_profile_zero_effects', profileHashes.pre !== undefined && profileHashes.post !== undefined && profileHashes.pre === profileHashes.post, `profile tree digest pre=${String(profileHashes.pre).slice(0, 12)} post=${String(profileHashes.post).slice(0, 12)}`)
  C_('n_native_plugin_manager_list', ctlRow('passthrough-native', 'plugin_manager') !== undefined && classForCtl('passthrough-native', 'plugin_manager') !== undefined && classForCtl('passthrough-native', 'plugin_manager')?.code !== 'U4_GUARD_VETO', `non-governed plugin_manager reached the NATIVE body: class=${classForCtl('passthrough-native', 'plugin_manager')?.code};msg=${String(classForCtl('passthrough-native', 'plugin_manager')?.msgHead ?? '').slice(0, 60)}`)
  C_('n_native_list_agents', classForName('list_agents') !== undefined && classForName('list_agents')?.code !== 'U4_GUARD_VETO', `list_agents class=${classForName('list_agents')?.code} (native behavior kept; name is NOT governed)`)
  C_('n_native_send_message', ctlRow('passthrough-native', 'send_message', 'g1fa-native-probe') !== undefined && classForCtl('passthrough-native', 'send_message', 'g1fa-native-probe') !== undefined && classForCtl('passthrough-native', 'send_message', 'g1fa-native-probe')?.code !== 'U4_GUARD_VETO', `class=${classForCtl('passthrough-native', 'send_message', 'g1fa-native-probe')?.code} (native, ungoverned session)`)

  // ── global invariants ─────────────────────────────────────────────────────
  const bStarts = bodyStarts.filter((r) => r.body === 'B')
  const bMarkers = markers.filter((m) => m.startsWith('B-'))
  C_('global_b_exactly_plant', bStarts.length === 1 && bStarts[0]?.tag === 'f1' && bMarkers.length === 2 && bMarkers.includes('B-f1.marker') && bMarkers.includes('B-f1.echo'), `B starts=${bStarts.map((r) => r.tag).join(',') || 'none'};B markers=${bMarkers.join(',')}`)
  C_('global_bp_exactly_bound', bodyStarts.filter((r) => r.body === 'Bp').every((r) => r.tag === 'p5b') && bodyStarts.filter((r) => r.body === 'Bp').length === 1, `Bp rows=${bodyStarts.filter((r) => r.body === 'Bp').length}`)
  C_('global_bdiv_never_ran', !rows.some((r) => JSON.stringify(r).includes('"Bdiv"') && ['body-start', 'grant-violation', 'leg-read', 'leg-process'].includes(r.leg)), 'Bdiv body legs never ran')
  C_('global_never_zero', !rows.some((r) => JSON.stringify(r).includes('u4_h0_never')), 'never-called name untouched')
  C_('global_markers_exact', JSON.stringify(markers) === JSON.stringify(expectedMarkers), `got=${markers.length};expected=${expectedMarkers.length};diff=${markers.filter((m) => !expectedMarkers.includes(m)).join(',') || '-'}|missing=${expectedMarkers.filter((m) => !markers.includes(m)).join(',') || '-'}`)
  const vetoes = guard.filter((r) => r.phase === 'veto')
  C_('global_guard_vetoes_seen', vetoes.filter((r) => r.reason === 'identity-mismatch').length >= 2 && vetoes.some((r) => r.reason === 'not-visible'), `vetoes=${vetoes.map((v) => `${v.tag}:${v.reason}${v.nested ? '/nested' : ''}`).join(',')}`)

  const settledAll = GROUPS.every((g) => ctlRows.some((r) => r.action === 'settle' && r.tag === g.name))
  C_('protocol', noTokenStatus === 401 && typeof sessionIds.T === 'string' && typeof sessionIds.N === 'string' && Array.isArray(promptStatuses) && promptStatuses.length === GROUPS.length && promptStatuses.every((s) => s === 200), `401=${String(noTokenStatus)};prompts=${String(promptStatuses.join ? promptStatuses.join(',') : '')}`)
  C_('wire_secondary', true, `toolNames-probes recorded (see steps wire-probe)`)
  cells.wire_secondary.gating = false
  const gating = Object.entries(cells).filter(([, c]) => c.gating !== false)
  const pass = settledAll && gating.every(([, c]) => c.pass === true)
  return {
    pass, settled: settledAll, final,
    outcome: !settledAll ? 'pending' : pass ? 'host-equivalent-guard-passes-all-cells' : 'CELL-FAILURE',
    counts: { bodyRows: bodyStarts.length, markers: markers.length, results: resultRows.length, vetoes: vetoes.length, ctlVetoes: by('ctl-guard').filter((r) => r.phase === 'veto').length, equiv: equiv.length, mockRequests: (mock?.requests ?? []).length },
    cells,
    scope_note: 'PASS proves, on the pinned pristine Host through public seams only: the next()-passing center guard reaches Host-native cancellation settlement (ABORTED vs ABORTED_BEFORE_DISPATCH via bodyInvoked), keeps the Host signal fuse/restore intact, blocks in-window swaps via the Host pre-dispatch abort check fed by a synchronous tools/change watcher, characterizes the result-path re-resolve semantics (post-execute value replacement under parity/divergence, block, finalize/project capture at createExecution, scheduler classification race), serves nested parent-token sub-dispatches through the same guard, refuses late registrations by non-center plugins for governed names unless explicitly bound, and denies agent-control names for governed sessions with zero observable effects while a non-governed session keeps native behavior. PTC run_code transport itself is not mounted (native mode) — nested dispatch is simulated via the public parent-token execute path (limit stated in README).',
  }
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms) })

export async function runOnceG1A({ port, worldName }) {
  const stamp = worldName.slice(WORLD_PREFIX.length)
  const world = validateInputs({ port, worldName })
  const runDir = join(HERE, 'runs', worldName)
  const ev = { runDir, markerDir: join(runDir, 'markers'), ledger: join(runDir, 'ledger.jsonl'), steps: join(runDir, 'steps.jsonl'), summary: join(runDir, 'summary.json') }
  const deadline = Date.now() + RUN_BUDGET_MS
  const remaining = () => deadline - Date.now()
  const runAbort = new AbortController()
  let timedOut = false; let instance; let hostChild; let mock; let token; let oracle; let failed = false; let runError
  const sessionIds = {}; let noTokenStatus; const promptStatuses = []
  const profileHashes = {}
  const spoofMarker = `G1A-SPOOF-${stamp}`
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
  try {
    for (const c of preflight({ port })) { recordStep('preflight', c.ok ? 'ok' : 'fail', c); if (!c.ok) throw new Error(`preflight failed: ${c.check} — ${String(c.detail)}`) }
    mkdirSync(join(world, 'profiles', 'web'), { recursive: true })
    mkdirSync(join(world, 'sentinel'), { recursive: true })
    for (const f of ['g1fa-shared.mjs', 'g1fa-plugin.mjs', 'g1fa-registrant.mjs']) copyFileSync(join(HERE, f), join(world, 'profiles', 'web', f))
    const sentinel = `g1fa-sentinel-ok-${stamp}\n`
    writeFileSync(join(world, 'sentinel', 'g1-sentinel.txt'), sentinel)
    recordStep('world-skeleton', 'ok', { world })
    instance = new DshInstance({ hostTree: HTU, dshHome: world, port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: runDir })
    instance.mountRows(PROBE_ROWS.map((r) => ({ ...r })), [...PATCH_HEADER_LINES])
    appendFileSync(instance.patchFile, EXT_CONTRIBUTOR_ROWS)
    const patchText = readFileSync(instance.patchFile, 'utf8')
    if (patchText !== buildPatchText()) throw new Error('patch layer mismatch vs buildPatchText()')
    recordStep('patch', 'ok', { sha256: sha256File(instance.patchFile) })
    mkdirSync(ev.markerDir, { recursive: true })
    recordStep('env-scrub', 'ok', { removed_keys: scrubProviderEnv() })
    process.env.DEEPSEEK_BASE_URL = 'http://127.0.0.1:__PORT__'
    process.env.DEEPSEEK_API_KEY = FAKE_KEY
    process.env.G1A_LEDGER = ev.ledger
    process.env.G1A_MARKER_DIR = ev.markerDir
    process.env.G1A_SENTINEL = join(world, 'sentinel', 'g1-sentinel.txt')
    process.env.G1A_SENTINEL_EXPECT = sentinel.trim()
    mock = await startMockModel({
      port: 0,
      decide: makeDecideG1A({ onProbe: (p) => recordStep('wire-probe', 'info', p), sessionIds, spoofMarker }),
      log: (m) => recordStep('mock', 'info', m),
      fixtures: {
        dir: join(runDir, 'wire'),
        limit: 20,
        maxTextLength: 2400,
        select: (record, parsed) => {
          const s = JSON.stringify(parsed?.messages ?? '')
          return s.includes(PROMPT_MARKER_T) || s.includes(PROMPT_MARKER_N) ? `probe-req-${String(record.method ?? 'post')}` : null
        },
      },
    })
    process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
    recordStep('mock-listen', 'ok', { port: mock.port })
    const startPromise = instance.start({ timeoutMs: Math.min(BOOT_TIMEOUT_MS, remaining()) }) // 1st and ONLY Host start of this attempt
    hostChild = instance.child
    const booted = await startPromise
    token = new URL(booted.url).searchParams.get('token') ?? undefined
    recordStep('host-boot', 'ok', { owned_pid: hostChild?.pid ?? null, token_fingerprint: token === undefined ? 'absent' : createHash('sha256').update(token).digest('hex').slice(0, 8) })
    const origin = `http://127.0.0.1:${port}`
    { // activation gate (H0 lesson: a failed plugin import would otherwise loop forever)
      const gateUntil = Date.now() + 15_000
      let activated = false; let importFailed = false
      for (;;) {
        try {
          const logText = readFileSync(instance.logPath, 'utf8')
          if (/g1fa-(center|registrant)[^\n]*(failed to import|did not activate)/.test(logText)) { importFailed = true; break }
        } catch { /* log may lag */ }
        const rs = readLedger(ev.ledger)
        if (rs.some((r) => r.leg === 'register' && r.ok === true && r.body === 'A')) { activated = true; break }
        if (Date.now() >= gateUntil) break
        await sleep(250)
      }
      recordStep('plugin-activation', activated ? 'ok' : 'fail', { activated, importFailed })
      if (!activated) throw new Error(`plugin activation gate failed (importFailed=${String(importFailed)})`)
    }
    noTokenStatus = await probeNoToken(origin)
    recordStep('token-gate', noTokenStatus === 401 ? 'ok' : 'fail', { status: noTokenStatus })
    if (noTokenStatus !== 401) throw new Error(`token gate: expected 401, got ${String(noTokenStatus)}`)
    const cookie = await authenticate(origin, token, runAbort.signal)
    recordStep('authenticate', 'ok')
    for (const key of ['T', 'N']) {
      const createRes = await apiSessionCreate(origin, cookie, world, `g1fa-${key}`, runAbort.signal)
      if (createRes.status !== 200) throw new Error(`session/create ${key} returned ${String(createRes.status)}`)
      sessionIds[key] = JSON.stringify(createRes.body).match(/"sessionId":"([^"]+)"/)?.[1]
      if (typeof sessionIds[key] !== 'string') throw new Error(`sessionId ${key} absent`)
      recordStep('session-create', 'ok', { key })
    }
    profileHashes.pre = treeDigest(treeHash(join(world, 'profiles')))
    for (const group of GROUPS) {
      const marker = group.sess === 'T' ? `${PROMPT_MARKER_T}-${stamp}` : `${PROMPT_MARKER_N}-${stamp}`
      const res = await apiPrompt(origin, cookie, sessionIds[group.sess], `g1fa ${stamp} ${group.name} ${marker}`, `g1a-${group.name}`, runAbort.signal)
      promptStatuses.push(res.status)
      recordStep('prompt', res.status === 200 ? 'ok' : 'fail', { group: group.name, sess: group.sess, status: res.status })
      if (res.status !== 200) throw new Error(`prompt ${group.name} returned ${String(res.status)}`)
      const waitUntil = Date.now() + Math.min(GROUP_WAIT_MS, Math.max(1, remaining()))
      let done = false
      for (;;) {
        const rows = readLedger(ev.ledger)
        if (rows.some((r) => r.leg === 'ctl' && r.action === 'settle' && r.tag === group.name)) { done = true; break }
        if (Date.now() >= waitUntil || remaining() <= 0) break
        await sleep(400)
      }
      recordStep('group', done ? 'ok' : 'fail', { group: group.name, settled: done })
      if (!done) throw new Error(`group ${group.name} not settled within bound`)
      if (group.name === 'G11') profileHashes.post = treeDigest(treeHash(join(world, 'profiles')))
    }
    profileHashes.post ??= treeDigest(treeHash(join(world, 'profiles')))
    oracle = evaluateG1AOracle({ ev, noTokenStatus, sessionIds, promptStatuses, mock, final: true, spoofMarker, profileHashes })
    recordStep('oracle', oracle.pass ? 'ok' : 'fail', { outcome: oracle.outcome, counts: oracle.counts })
    if (!oracle.pass) failed = true
  } catch (error) {
    failed = true
    runError = scrubSecrets(String(error?.message ?? error), token)
    recordStep('run', 'fail', { error: runError })
    try { if (mock !== undefined) oracle = evaluateG1AOracle({ ev, noTokenStatus, sessionIds, promptStatuses, mock, final: true, spoofMarker, profileHashes }) } catch { /* keep partial */ }
  } finally {
    clearTimeout(watchdog)
    if (runAbort.signal.aborted || timedOut) failed = true
    if (instance !== undefined) {
      try { const stopped = await instance.stop({ timeoutMs: Math.min(TEARDOWN_STEP_MS, Math.max(1, remaining())) }); recordStep('teardown-host', 'ok', stopped) } catch (e) { failed = true; recordStep('teardown-host', 'fail', { error: scrubSecrets(String(e?.message ?? e), token) }) }
      if (hostChild !== undefined && hostChild.exitCode === null && hostChild.signalCode === null) {
        failed = true
        try { hostChild.kill('SIGKILL') } catch { /* recorded below */ }
        const gone = await Promise.race([new Promise((res) => hostChild.once('close', () => res(true))), sleep(TEARDOWN_STEP_MS).then(() => false)])
        recordStep('teardown-host-kill', gone ? 'ok' : 'fail', { reason: 'owned child SIGKILL requested', reaped: gone })
      }
    }
    if (mock !== undefined) { try { await mock.close(); recordStep('teardown-mock', 'ok') } catch (e) { failed = true; recordStep('teardown-mock', 'fail', { error: String(e?.message ?? e) }) } }
    if (instance !== undefined && existsSync(instance.logPath)) {
      try {
        const raw = readFileSync(instance.logPath, 'utf8')
        writeFileSync(`${instance.logPath}.redacted`, scrubSecrets(raw, token))
      } catch { /* evidence hygiene best effort */ }
    }
    const gitAfter = { head: spawnSync('git', ['-C', HTU, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim(), porcelain: spawnSync('git', ['-C', HTU, 'status', '--porcelain'], { encoding: 'utf8' }).stdout }
    recordStep('post-check-htu', gitAfter.head === HTU_PIN && (gitAfter.porcelain ?? '') === '' ? 'ok' : 'fail', { head: gitAfter.head?.slice(0, 12), porcelain: (gitAfter.porcelain ?? '').slice(0, 200) })
    writeFileSync(ev.summary, JSON.stringify({ worldName, port, owned_pid: hostChild?.pid ?? null, run_error: runError ?? null, pass: !failed && oracle?.pass === true, timed_out: timedOut, budget_ms: RUN_BUDGET_MS, used_ms: RUN_BUDGET_MS - Math.max(0, remaining()), budget: { host_start: 1, note: 'G1F-SUP-A: ≤2 starts / ≤6 experiments package' }, oracle }, null, 2) + '\n')
  }
  return { pass: !failed && oracle?.pass === true, oracle, runDir }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2)
  const go = args.includes('--go')
  const portIdx = args.indexOf('--port')
  const port = portIdx >= 0 ? Number(args[portIdx + 1]) : SANCTIONED_PORT
  const worldName = `g1fa-${utcStamp()}`
  if (!go) {
    console.log('== G1F-SUP-A DRY RUN (read-only; zero spawn, zero world writes) ==')
    for (const c of preflight({ port })) console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.check} (${c.detail})`)
    console.log(`patch bytes:\n${buildPatchText()}`)
    console.log(`groups=${GROUPS.length} entries T=${SCRIPT_T.length} N=${SCRIPT_N.length}`)
    for (const g of GROUPS) console.log(`  ${g.name} (${g.sess}): ${g.script.map((s) => `${s.id}:${s.name === CTL ? s.arguments.action : s.name === LATE_CTL ? `late-${s.arguments.action}` : s.name === TARGET ? s.arguments.tag : s.name}`).join(' ')}`)
    console.log(`world would be: tests/homes/${worldName} (port ${port})`)
    process.exit(preflight({ port }).every((c) => c.ok) ? 0 : 1)
  }
  const out = await runOnceG1A({ port, worldName })
  console.log(JSON.stringify({ pass: out.pass, outcome: out.oracle?.outcome, counts: out.oracle?.counts, cells: Object.fromEntries(Object.entries(out.oracle?.cells ?? {}).map(([k, v]) => [k, { pass: v.pass, gating: v.gating, detail: v.detail }])) }, null, 2))
  process.exit(out.pass ? 0 : 1)
}
