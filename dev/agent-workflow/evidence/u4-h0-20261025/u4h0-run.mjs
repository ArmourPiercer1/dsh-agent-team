/**
 * U4-H0 H0 Definition-TOCTOU guard PoC — single-run Host experiment runner.
 *
 * Default is --dry-run (read-only preflight + full print, zero spawn, zero world writes).
 * `--go` executes EXACTLY ONE bounded Host run: 1 Host start, 0 retries, 30-min watchdog,
 * sanctioned ports only (:3080 and ~/.dsh forbidden), env-scrubbed provider env pointing
 * at the loopback mock, bounded owned teardown (only the PID we spawned), sealed-dir
 * integrity assertions, and a ledger/marker-first oracle. Budget accounting (PoC 5/20,
 * Host 5/12 on success — see README ledger) is recorded by the operator from steps.jsonl.
 *
 * Matrix (all legs in ONE session; groups separated by prompts, chained by the mock):
 *   G1 (a) stable positive control + (b) at-rest same-object regeneration control
 *   G2 (c) foreign agent-scoped shadow mid-body (armed) + pre-guard shadow veto + restore control
 *   G3 (d) scope restriction veto + restore control + (e) microtask shadow race
 *   G4 (b') in-flight same-object regen + (c') global same-name swap mid-body
 *   G5 (f) sensitivity plant: guard deliberately OFF → fence swaps A→B → B MUST execute
 *   G6 (e',e'') race repeats + final status
 * PASS = zero unverified Body executions across G1–G4/G6 (no B rows/markers/echo files
 * except the G5 plant) + (f) shows B executing with marker + process leg + correct
 * positives; wire-side delivery is recorded secondary (M2 sealed-run lesson).
 * @module dev/agent-workflow/evidence/u4-h0-20261025/u4h0-run
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { basename, dirname, join, resolve } from 'node:path'
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
export const FAKE_KEY = 'u4-h0-mock-key'
export const TEST_PORT_RANGES = Object.freeze([Object.freeze([3180, 3186]), Object.freeze([3491, 3500])])
export const STABLE_INSTANCE_PORT = 3080
export const WORLD_PREFIX = 'u4-h0-'
export const RUN_BUDGET_MS = 30 * 60_000
export const TEARDOWN_STEP_MS = 15_000
export const BOOT_TIMEOUT_MS = 90_000
export const GROUP_WAIT_MS = 150_000
export const SCRUBBED_ENV_KEYS = Object.freeze([
  'DEEPSEEK_API_KEY', 'DEEPSEEK_SEARCH_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 'MISTRAL_API_KEY', 'AZURE_OPENAI_API_KEY',
])
// Sealed prior-evidence integrity (read-only neighbors; bytes must not move).
export const SEALED = Object.freeze([
  [join(HERE, '..', 's1-h0-m1', 'm1-run.mjs'), '4542782e71d2b73b2f54e67c812b4ce945cd9d93fc0312f9dfcd5c882bfb07f0'],
  [join(HERE, '..', 's1-h0-m1', 'probe-plugin.mjs'), 'c883ac3f80efcfe4a4fe462b137f32cbfc1724fafb0662d19c92848a8618f195'],
  [join(HERE, '..', 's1-h0-m2', 'm2-run.mjs'), 'ef2bf20f30c1463862fa19500908d1d76500dd48a2b17f1edbeec7cbdc5a766b'],
  [join(HERE, '..', 's1-h0-m2', 'probe-m2-plugin.mjs'), '03d36a895cea8336a75dee4e4f67bdf1f4d252af29c1a35bbb1cab1169a0ea1b'],
])
export const MOCK_SHA256 = '8beade69588c105efb66df6a7a99dd915cb41b7aba91635ec0ebf73e6278fb06'
const PROMPT_MARKER = 'U4H0-FENCE-PROMPT'
const TARGET = 'u4_h0_target'
const CTL = 'u4h0_ctl'

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
  if (!isSanctionedTestPort(port)) throw new Error(`port ${String(port)} rejected (sanctioned 3180-3186/3491-3500; :3080 forbidden)`)
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
      if (cols.length < 4 || cols[3] !== '0A') continue // 0A = LISTEN
      const port = Number.parseInt(cols[1]?.split(':')?.[1] ?? '', 16)
      if (Number.isFinite(port)) ports.add(port)
    }
  }
  return ports
}

export function preflight({ port }) {
  const git = (args) => spawnSync('git', ['-C', HTU, ...args], { encoding: 'utf8' }).stdout?.trim() ?? ''
  const checks = [
    { check: 'port-sanctioned', ok: isSanctionedTestPort(port), detail: String(port) },
    { check: 'port-free-per-proc-net', ok: !procNetPorts().has(port), detail: String(port) },
    { check: 'htu-rev-parse-equals-pin', ok: git(['rev-parse', 'HEAD']) === HTU_PIN, detail: git(['rev-parse', 'HEAD']).slice(0, 12) },
    { check: 'htu-status-porcelain-empty', ok: git(['status', '--porcelain']) === '', detail: git(['status', '--porcelain']).slice(0, 200) },
    { check: 'htu-entry-exists', ok: existsSync(HOST_ENTRY), detail: HOST_ENTRY },
    { check: 'bin-echo-exists', ok: existsSync('/bin/echo'), detail: '/bin/echo' },
    { check: 'mock-copy-bytes', ok: sha256File(join(HERE, 'mock-deepseek.mjs')) === MOCK_SHA256, detail: MOCK_SHA256.slice(0, 12) },
    { check: 'plugin-exists', ok: existsSync(join(HERE, 'u4h0-probe-plugin.mjs')), detail: 'u4h0-probe-plugin.mjs' },
    ...SEALED.map(([p, sha]) => ({ check: `sealed-unchanged:${basename(p)}`, ok: existsSync(p) && sha256File(p) === sha, detail: sha.slice(0, 12) })),
  ]
  return checks
}

export const PROBE_ROWS = Object.freeze([{ id: 'u4h0-probe', name: './u4h0-probe-plugin.mjs' }])
export const PATCH_HEADER_LINES = Object.freeze([
  'U4 H0: ONE plain plugin row via the public profile-patch seam (DshInstance.mountRows).',
  'Relative name resolves beside this patch file (app-boot @639ed015). No preset, no Team row.',
])
/** The root-authorized differential rows from the sealed M1/M2/M3 line: disable ONLY the two
 *  metadata contributor plugins through their own public config flag (otherwise turn-1 dies
 *  with the same REQUEST_EXTENSION as sealed s1-h0-m1 FAIL run). */
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
const H = (id, tag) => C(`h${id.slice(1)}`, 'heal', { tag })
export const GROUPS = Object.freeze([
  { name: 'G1', script: [H('t00', 'G1'), C('t01', 'status'), T('t02', 'a1', 'stable'), C('t03', 'regen-same'), T('t04', 'b1', 'stable'), C('t05', 'settle', { tag: 'G1' })] },
  { name: 'G2', script: [H('t10', 'G2'), C('t06', 'arm', { kind: 'shadow-mid', delayMs: 150, autoRestoreMs: 700 }), T('t07', 'c1', 'race', 300), C('t08', 'shadow-on'), T('t09', 'c2', 'stable'), C('t10', 'shadow-off'), T('t11', 'c3', 'stable'), C('t12', 'settle', { tag: 'G2' })] },
  { name: 'G3', script: [H('t20', 'G3'), C('t13', 'restrict-on'), T('t14', 'd1', 'stable'), C('t15', 'restrict-off'), T('t16', 'd2', 'stable'), C('t17', 'arm', { kind: 'micro-shadow', autoRestoreMs: 700 }), T('t18', 'e1', 'race', 200), C('t19', 'settle', { tag: 'G3' })] },
  { name: 'G4', script: [H('t30', 'G4'), C('t20', 'arm', { kind: 'regen-mid', delayMs: 150 }), T('t21', 'b2', 'race', 300), C('t22', 'arm', { kind: 'global-swap-mid', delayMs: 150, autoRestoreMs: 400 }), T('t23', 'c1g', 'race', 300), C('t24', 'settle', { tag: 'G4' })] },
  { name: 'G5', script: [H('t40', 'G5'), C('t25', 'guard-off'), T('t26', 'f1', 'fence-swap'), C('t27', 'guard-on'), T('t28', 'f2', 'stable'), C('t29', 'settle', { tag: 'G5' })] },
  { name: 'G6', script: [H('t50', 'G6'), C('t30', 'arm', { kind: 'micro-shadow', autoRestoreMs: 700 }), T('t31', 'e2', 'race', 200), C('h55', 'heal', { tag: 'G6b' }), C('t32', 'arm', { kind: 'shadow-mid', delayMs: 150, autoRestoreMs: 700 }), T('t33', 'e3', 'race', 300), C('t34', 'status', { tag: 'final' }), C('t35', 'settle', { tag: 'G6' })] },
])
export const SCRIPT = Object.freeze(GROUPS.flatMap((g) => g.script))

/** decide({seq,req}): idle-text while the prompt marker is absent (title request);
 *  otherwise the first SCRIPT entry whose tool_result is missing from the history;
 *  when the whole script is answered → terminal text.
 *  CIRCUIT BREAKERS (from the sealed 13-24-48Z runaway postmortem: an unregistered
 *  tool name is never "answered" on this host, and the loop re-issued t01 2300+
 *  times until the runner OOM'd): at most MAX_REPEAT consecutive issues of the
 *  same entry, and at most MAX_TOTAL decide() tool-issues overall; beyond either,
 *  answer terminal text so the turn dies and the bounded group-wait records FAIL. */
export function makeDecideU4({ maxRepeat = 8, maxTotal = 400, onProbe = () => {} } = {}) {
  let lastId; let repeat = 0; let issues = 0; let probes = 0
  return ({ req }) => {
    const messages = Array.isArray(req?.messages) ? req.messages : []
    const flat = JSON.stringify(messages)
    if (probes < 6) {
      probes += 1
      const toolNames = (Array.isArray(req?.tools) ? req.tools : []).map((t) => t?.function?.name ?? t?.name ?? '?')
      onProbe({ marker: flat.includes(PROMPT_MARKER), msgCount: messages.length, toolsCount: toolNames.length, toolsHasTarget: toolNames.includes(TARGET), toolsHasCtl: toolNames.includes(CTL), toolNames: toolNames.slice(0, 48) })
    }
    if (!flat.includes(PROMPT_MARKER)) return { kind: 'text', content: 'u4-idle' }
    const answered = (id) => messages.some((m) => {
      if (m?.role === 'tool' && (m.tool_call_id === id || m.toolCallId === id)) return true
      for (const part of Array.isArray(m?.content) ? m.content : []) {
        if (part?.type === 'tool_result' && (part.tool_use_id === id || part.toolCallId === id)) return true
      }
      return false
    })
    const next = SCRIPT.find((entry) => !answered(`u4-${entry.id}`))
    if (next === undefined) return { kind: 'text', content: 'u4-complete' }
    const id = `u4-${next.id}`
    repeat = lastId === id ? repeat + 1 : 1
    lastId = id
    issues += 1
    if (repeat > maxRepeat || issues > maxTotal) return { kind: 'text', content: `u4-circuit-break entry=${next.id} repeat=${String(repeat)} issues=${String(issues)}` }
    return { kind: 'tool-call', toolCalls: [{ id, name: next.name, arguments: next.arguments }] }
  }
}

function readLedger(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => { try { return JSON.parse(l) } catch { return { leg: 'unparseable', raw: l.slice(0, 120) } } })
}

/**
 * Oracle. Ground truth = ledger rows + marker files (side effects), NOT wire shape.
 * `settled` = every group settle row seen. Cell semantics are fixed BEFORE the run.
 */
export function evaluateU4Oracle({ ev, noTokenStatus, sessionId, promptStatuses, mock, final = false }) {
  const rows = readLedger(ev.ledger)
  const by = (leg) => rows.filter((r) => r.leg === leg)
  const bodyStarts = by('body-start')
  const markers = existsSync(ev.markerDir) ? readdirSync(ev.markerDir).sort() : []
  const bStarts = bodyStarts.filter((r) => r.body === 'B')
  const bMarkers = markers.filter((m) => m.startsWith('B-'))
  const vetoes = by('guard').filter((r) => r.phase === 'veto')
  const watchAborted = by('change-watch').flatMap((r) => Array.isArray(r.abortedTags) ? r.abortedTags : [])
  const aTag = (tag) => bodyStarts.find((r) => r.body === 'A' && r.tag === tag)
  const aEnd = (tag) => by('body-end').find((r) => r.body === 'A' && r.tag === tag)
  const vetoFor = (tag) => vetoes.find((r) => r.tag === tag)
  const ctl = (action, tag) => by('ctl').find((r) => r.action === action && (tag === undefined || r.tag === tag))
  const legsOkFor = (tag) => {
    const legRows = rows.filter((r) => ['leg-read', 'leg-process'].includes(r.leg) && r.tag === tag)
    return legRows.length >= 0 && legRows.every((r) => r.ok === true)
  }
  const settled = GROUPS.every((g) => by('ctl').some((r) => r.action === 'settle' && r.tag === g.name))
  const cells = {}
  // fixture hygiene: every group opened on a healed base (shadows cleared, arms
  // drained, approved A visible) — without this, a leaked vector poisons later cells.
  cells.fixture_heal = { pass: GROUPS.every((g) => by('ctl').some((r) => r.action === 'heal' && r.tag === g.name && r.ok === true)), detail: GROUPS.map((g) => `${g.name}:${by('ctl').find((r) => r.action === 'heal' && r.tag === g.name)?.ok ?? 'missing'}`).join(',') }
  // (a) stable positive control
  cells.a_stable = { pass: aTag('a1') !== undefined && aEnd('a1')?.ran === true && legsOkFor('a1'), detail: `body=${aEnd('a1')?.ran === true}` }
  // (b) generation change: at-rest same-object regen runs A; in-flight regen never runs B
  cells.b_regen_at_rest = { pass: by('ctl').some((r) => r.action === 'regen-same' && r.ok === true) && aTag('b1') !== undefined && aEnd('b1')?.ran === true, detail: `b1 ran=${aEnd('b1')?.ran === true}` }
  cells.b_regen_inflight = { pass: by('center').some((r) => r.kind === 'regen-mid') && aTag('b2') !== undefined && !bStarts.some((r) => r.tag === 'b2'), detail: `A-only=${aTag('b2') !== undefined}; aborted=${watchAborted.includes('b2')}` }
  // (c) same-name foreign replacement: mid-body shadow (A-only, B zero) + pre-guard veto + restore
  cells.c_foreign_midbody = { pass: by('foreign').some((r) => r.kind === 'shadow-mid' && r.phase === 'add' && r.ok === true) && aTag('c1') !== undefined && !bStarts.some((r) => r.tag === 'c1') && !markers.includes('B-c1.marker'), detail: `A-only; watch-abort=${watchAborted.includes('c1')}` }
  cells.c_preguard_veto = { pass: vetoFor('c2')?.reason === 'identity-mismatch' && aTag('c2') === undefined && !bStarts.some((r) => r.tag === 'c2'), detail: `veto=${vetoFor('c2')?.reason ?? 'none'}; B-runs=${bStarts.filter((r) => r.tag === 'c2').length}` }
  cells.c_restore_control = { pass: aEnd('c3')?.ran === true && legsOkFor('c3'), detail: `c3 ran=${aEnd('c3')?.ran === true}` }
  // (d) scope change: restriction → pre-body veto; lift → A again
  cells.d_restrict_veto = { pass: ctl('restrict-on')?.ok === true && vetoFor('d1')?.reason === 'not-visible' && aTag('d1') === undefined && !bStarts.some((r) => r.tag === 'd1'), detail: `veto=${vetoFor('d1')?.reason ?? 'none'}; ctl-ok=${ctl('restrict-on')?.ok}` }
  cells.d_lift_control = { pass: aEnd('d2')?.ran === true && legsOkFor('d2'), detail: `d2 ran=${aEnd('d2')?.ran === true}` }
  // (e) async races (microtask/timer replacements): A-only in every repeat, zero B
  const eTags = ['e1', 'e2', 'e3']
  cells.e_races = { pass: eTags.every((t) => aTag(t) !== undefined && !bStarts.some((r) => r.tag === t) && !markers.includes(`B-${t}.marker`)), detail: eTags.map((t) => `${t}:${aTag(t) ? 'A-only' : 'MISSING'}`).join(',') }
  // (f) sensitivity plant: B MUST be observed executing (marker + process leg), then A control
  const f1 = bStarts.find((r) => r.tag === 'f1')
  const f1End = by('body-end').find((r) => r.body === 'B' && r.tag === 'f1')
  cells.f_plant_executes = { pass: f1 !== undefined && markers.includes('B-f1.marker') && by('leg-process').some((r) => r.body === 'B' && r.tag === 'f1' && r.ok === true), detail: `B-ran=${f1End?.ran === true}; marker+process-leg observed` }
  cells.f_after_restore = { pass: aEnd('f2')?.ran === true && legsOkFor('f2'), detail: `f2 ran=${aEnd('f2')?.ran === true}` }
  // global safety invariants
  cells.global_b_exactly_plant = { pass: bStarts.length === 1 && bStarts[0]?.tag === 'f1' && bMarkers.length === 2 && bMarkers.includes('B-f1.marker') && bMarkers.includes('B-f1.echo'), detail: `B starts=${String(bStarts.length)} (${bStarts.map((r) => r.tag).join(',')}); B markers=${bMarkers.join(',')}` }
  cells.global_never_zero = { pass: !rows.some((r) => JSON.stringify(r).includes('u4_h0_never')), detail: 'never-called name untouched' }
  cells.global_guard_vetoes_seen = { pass: vetoes.length >= 2, detail: `vetoes=${vetoes.map((v) => `${v.tag}:${v.reason}`).join(',')}` }
  cells.protocol = { pass: noTokenStatus === 401 && typeof sessionId === 'string' && Array.isArray(promptStatuses) && promptStatuses.length === GROUPS.length && promptStatuses.every((s) => s === 200), detail: `401=${String(noTokenStatus)}; prompts=${String(promptStatuses.join ? promptStatuses.join(',') : '')}` }
  // secondary (recorded, NOT gating): wire delivery of results + final terminal turn
  const wireDelivered = (id) => (mock?.requests ?? []).some((r) => r?.status === 200 && Array.isArray(r?.body?.messages) && JSON.stringify(r.body.messages).includes(`u4-${id}`))
  cells.wire_secondary = { pass: true, gating: false, detail: `targets-delivered=${SCRIPT.filter((e) => e.name === TARGET).filter((e) => wireDelivered(e.id)).length}/${SCRIPT.filter((e) => e.name === TARGET).length}` }
  const gating = Object.entries(cells).filter(([, c]) => c.gating !== false)
  const pass = settled && gating.every(([, c]) => c.pass === true)
  return {
    pass, settled, final,
    outcome: !settled ? 'pending' : pass ? 'guard-prevented-all-unverified-zero' : 'UNVERIFIED-BODY-OR-MISSING-CELL',
    counts: { bodyRows: bodyStarts.length, aStarts: bodyStarts.filter((r) => r.body === 'A').length, bStarts: bStarts.length, markers: markers.length, vetoes: vetoes.length, mockRequests: (mock?.requests ?? []).length },
    cells,
    scope_note: 'PASS proves: (i) with the guard active, a same-name replacement (scoped shadow, global swap, restriction, regen, microtask/timer races) NEVER executed the unverified Body (marker/read/process side effects absent); (ii) the sensitivity plant DID execute it when the guard was deliberately disabled (oracle sensitivity); all on the pristine pinned Host via public registration/dispatch. It does NOT authorize claims beyond Definition-identity binding (see README conditions).',
  }
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms) })

export async function runOnceU4({ port, worldName }) {
  const stamp = worldName.slice(WORLD_PREFIX.length)
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
  try {
    for (const c of preflight({ port })) { recordStep('preflight', c.ok ? 'ok' : 'fail', c); if (!c.ok) throw new Error(`preflight failed: ${c.check} — ${String(c.detail)}`) }
    mkdirSync(join(world, 'profiles', 'web'), { recursive: true })
    mkdirSync(join(world, 'sentinel'), { recursive: true })
    copyFileSync(join(HERE, 'u4h0-probe-plugin.mjs'), join(world, 'profiles', 'web', 'u4h0-probe-plugin.mjs'))
    const sentinel = `u4h0-sentinel-ok-${stamp}\n`
    writeFileSync(join(world, 'sentinel', 'u4-sentinel.txt'), sentinel)
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
    process.env.U4_LEDGER = ev.ledger
    process.env.U4_MARKER_DIR = ev.markerDir
    process.env.U4_SENTINEL = join(world, 'sentinel', 'u4-sentinel.txt')
    process.env.U4_SENTINEL_EXPECT = sentinel.trim()
    mock = await startMockModel({
      port: 0,
      decide: makeDecideU4({ onProbe: (p) => recordStep('wire-probe', 'info', p) }),
      log: (m) => recordStep('mock', 'info', m),
      // Wire truth (G1 non-settle postmortem): dump the marker-marked request
      // envelopes so the tools list and result replay are inspectable offline.
      fixtures: {
        dir: join(runDir, 'wire'),
        limit: 14,
        maxTextLength: 2400,
        select: (record, parsed) => (JSON.stringify(parsed?.messages ?? '').includes(PROMPT_MARKER) ? `probe-req-${String(record.method ?? 'post')}` : null),
      },
    })
    process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
    recordStep('mock-listen', 'ok', { port: mock.port })
    const startPromise = instance.start({ timeoutMs: Math.min(BOOT_TIMEOUT_MS, remaining()) }) // 1st and ONLY Host start
    hostChild = instance.child
    const booted = await startPromise
    token = new URL(booted.url).searchParams.get('token') ?? undefined
    recordStep('host-boot', 'ok', { owned_pid: hostChild?.pid ?? null, token_fingerprint: token === undefined ? 'absent' : createHash('sha256').update(token).digest('hex').slice(0, 8) })
    const origin = `http://127.0.0.1:${port}`
    // Activation gate (runaway postmortem): the probe must import cleanly; on a
    // failed import the tools do not exist and the loop would re-issue forever.
    {
      const gateUntil = Date.now() + 15_000
      let activated = false; let importFailed = false
      for (;;) {
        try {
          const logText = readFileSync(instance.logPath, 'utf8')
          if (/u4h0-probe[^\n]*(failed to import|did not activate)/.test(logText)) { importFailed = true; break }
        } catch { /* log may lag */ }
        if (readLedger(ev.ledger).some((r) => r.leg === 'register' && r.ok === true)) { activated = true; break }
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
    const createRes = await apiSessionCreate(origin, cookie, world, 'u4h0', runAbort.signal)
    if (createRes.status !== 200) throw new Error(`session/create returned ${String(createRes.status)}`)
    sessionId = JSON.stringify(createRes.body).match(/"sessionId":"([^"]+)"/)?.[1]
    if (typeof sessionId !== 'string') throw new Error('sessionId absent')
    recordStep('session-create', 'ok')
    for (const group of GROUPS) {
      const res = await apiPrompt(origin, cookie, sessionId, `u4h0 ${stamp} ${group.name} ${PROMPT_MARKER}`, `u4-${group.name}`, runAbort.signal)
      promptStatuses.push(res.status)
      recordStep('prompt', res.status === 200 ? 'ok' : 'fail', { group: group.name, status: res.status })
      if (res.status !== 200) throw new Error(`prompt ${group.name} returned ${String(res.status)}`)
      const waitUntil = Date.now() + Math.min(GROUP_WAIT_MS, Math.max(1, remaining()))
      let done = false
      for (;;) {
        const rows = readLedger(ev.ledger)
        if (rows.some((r) => r.leg === 'ctl' && r.action === 'settle' && r.tag === group.name)) { done = true; break }
        if (Date.now() >= waitUntil || remaining() <= 0) break
        await sleep(400, runAbort.signal)
      }
      recordStep('group', done ? 'ok' : 'fail', { group: group.name, settled: done })
      if (!done) throw new Error(`group ${group.name} not settled within bound`)
    }
    oracle = evaluateU4Oracle({ ev, noTokenStatus, sessionId, promptStatuses, mock, final: true })
    recordStep('oracle', oracle.pass ? 'ok' : 'fail', { outcome: oracle.outcome, counts: oracle.counts })
    if (!oracle.pass) failed = true
  } catch (error) {
    failed = true
    runError = scrubSecrets(String(error?.message ?? error), token)
    recordStep('run', 'fail', { error: runError })
    try { if (mock !== undefined) oracle = evaluateU4Oracle({ ev, noTokenStatus, sessionId, promptStatuses, mock, final: true }) } catch { /* keep partial */ }
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
    writeFileSync(ev.summary, JSON.stringify({ worldName, port, owned_pid: hostChild?.pid ?? null, run_error: runError ?? null, pass: !failed && oracle?.pass === true, timed_out: timedOut, budget_ms: RUN_BUDGET_MS, used_ms: RUN_BUDGET_MS - Math.max(0, remaining()), budget: { poc_experiment: 'this run = 1 experiment (≤8 remaining of package allocation; see README ledger)', host_starts: 1 }, oracle }, null, 2) + '\n')
  }
  return { pass: !failed && oracle?.pass === true, oracle, runDir }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2)
  const go = args.includes('--go')
  const portIdx = args.indexOf('--port')
  const port = portIdx >= 0 ? Number(args[portIdx + 1]) : 3184
  const worldName = `u4-h0-${utcStamp()}`
  if (!go) {
    console.log('== U4-H0 DRY RUN (read-only; zero spawn, zero world writes) ==')
    for (const c of preflight({ port })) console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.check} (${c.detail})`)
    console.log(`patch bytes:\n${buildPatchText()}`)
    console.log(`groups=${GROUPS.length} script entries=${SCRIPT.length}`)
    for (const g of GROUPS) console.log(`  ${g.name}: ${g.script.map((s) => `${s.id}:${s.name === CTL ? s.arguments.action : s.arguments.tag}`).join(' ')}`)
    console.log(`world would be: tests/homes/${worldName} (port ${port})`)
    process.exit(preflight({ port }).every((c) => c.ok) ? 0 : 1)
  }
  const out = await runOnceU4({ port, worldName })
  console.log(JSON.stringify({ pass: out.pass, outcome: out.oracle?.outcome, counts: out.oracle?.counts, cells: Object.fromEntries(Object.entries(out.oracle?.cells ?? {}).map(([k, v]) => [k, { pass: v.pass, detail: v.detail }])) }, null, 2))
  process.exit(out.pass ? 0 : 1)
}
