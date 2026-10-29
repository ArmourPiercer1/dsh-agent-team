/**
 * S1 RUNTIME CENSUS launcher — pure-prep derivation of the sealed M3 runner
 * (sha256 d581e559656be4729a81f91888a63be727af6d0d405ab0fc7f80c127b05ed677, byte-untouched).
 * Reuses audited M1 helpers by import and the sealed M3 decide/oracle by import; the small diff:
 *   - census plugin row (`s1c-census`) instead of `s1m3-probe`; same no-ext variant rows (inherit
 *     the mock/noext limitation verbatim; real providers 0 — provider env scrubbed, loopback mock only);
 *   - census oracle extension: exactly one `leg:'census'` ledger row, on the restored-A CONTROL
 *     callID, with WeakMap identity fields (Definition + execute ref + scope ref), rootCallId,
 *     and the registered-visible name set from the PUBLIC tools.schemas(scope) (:1260) /
 *     tools.get(name,scope) (:1230) @639ed015;
 *   - offline seeds-union diff vs the independently preserved s1-m0-closure-v3-seeds 93 records
 *     (86 tool names + 4 surface obligations kept separate; fixture probe tools stay off-book).
 *
 * Static preflight asserts the census plugin bytes contain NO private-member references
 * (modeFor/view/wireSchemas/resolveExecution), no toString-as-identity, no eval/Function,
 * no monkeypatch assignments. No other tool body is ever executed.
 *
 * Default mode --dry-run (read-only). Real run requires --go (root GO only): 1 Host start,
 * 0 retries, bounded watchdog, loopback mock only. THIS PREP ROUND RUNS --dry-run ONLY.
 * @module dev/agent-workflow/evidence/s1-runtime-census/s1c-run
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BOOT_TIMEOUT_MS, CLIENT_COMMIT_HASH, EXT_CONTRIBUTOR_ROWS, FAKE_KEY, HOST_ENTRY, HTU, HTU_PIN,
  MOCK_SHA256_4AAAA, PROMPT_WAIT_MS, RUN_BUDGET_MS, STABLE_INSTANCE_PORT,
  TEARDOWN_STEP_MS, TOOLS_LIB, TOOL_NAME, buildSentinelContent,
  isSanctionedTestPort, procNetPorts, scrubProviderEnv, scrubSecrets, sha256File, utcStamp,
} from '../s1-h0-m1/m1-run.mjs'
import { DshInstance } from '../s1-h0-m1/instance.mjs'
import { portInUse, waitForPortFree } from '../s1-h0-m1/util.mjs'
import { startMockModel } from '../s1-h0-m1/mock-deepseek.mjs'
import { apiPrompt, apiSessionCreate, authenticate, probeNoToken } from '../s1-h0-m1/s1m1-session-client.mjs'
import { evaluateM3Oracle, makeDecideM3 } from '../s1-h0-m3/m3-run.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const M1_DIR = resolve(HERE, '..', 's1-h0-m1')
const M3_DIR = resolve(HERE, '..', 's1-h0-m3')
export const WORLD_PREFIX = 's1-census-'
export const SEALED_M3_RUNNER_SHA256 = 'd581e559656be4729a81f91888a63be727af6d0d405ab0fc7f80c127b05ed677'
export const SEALED_M3_PROBE_SHA256 = '181fc9a73fc77151f8bb3c232dc3778c9109366869e62403a834cb10c5cf57a3'
export const SEALED_M1_RUNNER_SHA256 = '4542782e71d2b73b2f54e67c812b4ce945cd9d93fc0312f9dfcd5c882bfb07f0'
export const SEALED_M1_PROBE_SHA256 = 'c883ac3f80efcfe4a4fe462b137f32cbfc1724fafb0662d19c92848a8618f195'
export const SEEDS_UNION_SHA256 = '2ce3e3e2b2c1f4a9682ccb554d75d50e55511ec7ff405d7d0efb8c705a5f9ae2'
export const CENSUS_PROMPT_MARKER = 'S1C-CENSUS-PROMPT'
const PROMPT_MARKER = CENSUS_PROMPT_MARKER

/** Forbidden token scan over the census plugin bytes (private seams / identity-stringification /
 *  monkeypatch). toString('utf8') for buffer decode (sealed-inherited sentinel read) is allowed. */
const FORBIDDEN_RES = [
  { re: /\bmodeFor\b/, why: 'private modeFor (:922) must never be referenced' },
  { re: /\bwireSchemas\b/, why: 'private wireSchemas (:1008) must never be referenced' },
  { re: /\bresolveExecution\b/, why: 'private resolveExecution (:1247) must never be referenced' },
  { re: /\.view\s*\(/, why: 'private view (:1178) must never be called' },
  { re: /\.toString\(\s*\)|\.toString\(\s*['"](?!utf8)/, why: 'toString must not be used as identity' },
  { re: /\beval\s*\(|\bnew\s+Function\b/, why: 'no dynamic code' },
  { re: /ctx\.tools\s*=[^=]|ctx\.on\s*=[^=]|ctx\.effect\s*=[^=]/, why: 'no monkeypatch of ctx seams' },
]
export function scanPluginBytes(text) {
  const hits = []
  for (const { re, why } of FORBIDDEN_RES) { const m = text.match(re); if (m !== null) hits.push({ why, matched: m[0] }) }
  return hits
}

export function validateInputs({ port, worldName }) {
  if (!Number.isInteger(port) || !isSanctionedTestPort(port) || port === STABLE_INSTANCE_PORT) throw new Error(`port ${String(port)} rejected (sanctioned test ranges only; :${String(STABLE_INSTANCE_PORT)} forbidden)`)
  if (!worldName.startsWith(WORLD_PREFIX)) throw new Error(`world must start with ${WORLD_PREFIX}`)
  if (basename(worldName) !== worldName || worldName.includes('..') || !/^s1-census-[A-Za-z0-9._-]+$/.test(worldName)) throw new Error(`world must be a single safe basename (got ${worldName})`)
  const world = join(HTU, '..', 'homes', worldName)
  if (existsSync(world)) throw new Error(`world path already exists: ${world}`)
  if (existsSync(`${world}.lock`)) throw new Error(`world lock already exists: ${world}.lock`)
  return world
}

export function preflight({ port, worldName }) {
  const git = (args) => spawnSync('git', ['-C', HTU, ...args], { encoding: 'utf8' }).stdout?.trim() ?? ''
  const pluginPath = join(HERE, 'census-probe-plugin.mjs')
  const pluginText = existsSync(pluginPath) ? readFileSync(pluginPath, 'utf8') : ''
  const hits = existsSync(pluginPath) ? scanPluginBytes(pluginText) : [{ why: 'plugin missing', matched: '' }]
  return [
    { check: 'port-sanctioned', ok: isSanctionedTestPort(port) && port !== STABLE_INSTANCE_PORT, detail: String(port) },
    { check: 'htu-rev-parse-equals-pin', ok: git(['rev-parse', 'HEAD']) === HTU_PIN, detail: git(['rev-parse', 'HEAD']).slice(0, 12) },
    { check: 'htu-status-porcelain-empty', ok: git(['status', '--porcelain']) === '', detail: git(['status', '--porcelain']).split('\n').filter((x) => x !== '').length },
    { check: 'htu-entry-exists', ok: existsSync(HOST_ENTRY), detail: HOST_ENTRY },
    { check: 'htu-tools-lib-exists', ok: existsSync(TOOLS_LIB), detail: TOOLS_LIB },
    { check: 'bin-echo-exists', ok: existsSync('/bin/echo'), detail: '/bin/echo' },
    { check: 'host-port-free-per-proc-net', ok: !procNetPorts().has(port), detail: String(port) },
    { check: 'sealed-m3-runner-bytes-unchanged', ok: sha256File(join(M3_DIR, 'm3-run.mjs')) === SEALED_M3_RUNNER_SHA256, detail: sha256File(join(M3_DIR, 'm3-run.mjs')).slice(0, 16) },
    { check: 'sealed-m3-probe-bytes-unchanged', ok: sha256File(join(M3_DIR, 'probe-m3-plugin.mjs')) === SEALED_M3_PROBE_SHA256, detail: sha256File(join(M3_DIR, 'probe-m3-plugin.mjs')).slice(0, 16) },
    { check: 'sealed-m3-run-dir-preserved', ok: existsSync(join(M3_DIR, 'runs', 's1-h0-m3-2026-10-25T00-18-09Z', 'summary.json')), detail: 'M3 run/PASS must stay untouched' },
    { check: 'm1-sealed-runner-bytes-unchanged', ok: sha256File(join(M1_DIR, 'm1-run.mjs')) === SEALED_M1_RUNNER_SHA256, detail: sha256File(join(M1_DIR, 'm1-run.mjs')).slice(0, 16) },
    { check: 'm1-sealed-probe-unchanged', ok: sha256File(join(M1_DIR, 'probe-plugin.mjs')) === SEALED_M1_PROBE_SHA256, detail: sha256File(join(M1_DIR, 'probe-plugin.mjs')).slice(0, 16) },
    { check: 'mock-copy-matches-4aaaa-blob', ok: sha256File(join(M1_DIR, 'mock-deepseek.mjs')) === MOCK_SHA256_4AAAA, detail: sha256File(join(M1_DIR, 'mock-deepseek.mjs')).slice(0, 16) },
    { check: 'census-plugin-exists', ok: existsSync(pluginPath), detail: 'census-probe-plugin.mjs' },
    { check: 'census-plugin-no-private-no-identity-tostring', ok: hits.length === 0, detail: hits.map((h) => h.why).join('; ').slice(0, 60) },
    { check: 'seeds-union-sha', ok: sha256File(join(HERE, 'seeds-union-offline.json')) === SEEDS_UNION_SHA256, detail: sha256File(join(HERE, 'seeds-union-offline.json')).slice(0, 16) },
    { check: 'world-absent', ok: !existsSync(join(HTU, '..', 'homes', worldName)), detail: worldName },
  ]
}

export const PROBE_ROWS = Object.freeze([{ id: 's1c-census', name: './s1c-census-plugin.mjs' }])
export const PATCH_HEADER_LINES = Object.freeze([
  'S1 CENSUS: ONE plain plugin row via the public profile-patch seam (written by DshInstance.mountRows).',
  'Relative name resolves beside this patch file (app-boot/src/index.ts:532,:994 @639ed015).',
  'No preset, no Team row, no PR360 assembly.',
])
export function buildPatchText() {
  const header = PATCH_HEADER_LINES.map((l) => `# ${l}`).join('\n')
  const insert = ['- insert:', ...PROBE_ROWS.flatMap((row) => [`    - id: ${row.id}`, `      name: ${JSON.stringify(row.name)}`]), ''].join('\n')
  return `${header}\n${insert}${EXT_CONTRIBUTOR_ROWS}`
}

function readLedger(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}

/** Model wire RECORDING ONLY (root fix #3): no native/PTC assertion — a PTC mode may also carry
 *  a tools[] (run_code). Names read from `name` OR `function.name`; the mode conclusion lives in
 *  summary.mode_evidence with its stated sample-scoped grounds only. */
export function modelPresentedFromMock(mock, tc1) {
  for (const r of mock?.requests ?? []) {
    if (r?.status !== 200 || r?.reply?.kind !== 'tool-call') continue
    if (!JSON.stringify(r.reply?.toolCalls ?? '').includes(tc1)) continue
    const tools = Array.isArray(r.body?.tools) ? r.body.tools : null
    const nm = (t) => (typeof t?.name === 'string' ? t.name : (typeof t?.function?.name === 'string' ? t.function.name : '<noname>'))
    return {
      protocol_shape: tools === null ? 'request body carries no tools[] member' : 'request body carries tools[] member',
      tools_array_present: tools !== null,
      tools_count: tools === null ? null : tools.length,
      names: tools === null ? null : tools.map(nm).sort(),
      interpretation: 'none here — wire shape alone does NOT decide native vs PTC (PTC may also carry a tools[]); see mode_evidence',
    }
  }
  return { protocol_shape: 'not-observed', tools_array_present: null, tools_count: null, names: null, interpretation: 'none' }
}

/** Census extension checks as a PURE function over ledger rows (root fix #2): complete 1:1
 *  correspondence between identity rows and visible names, no duplicates, every row bound to a
 *  real Definition/execute WeakMap ref under the SAME scope ref, repeat-get reference stability.
 *  Fixture-A === calibration is ONE row and substitutes for nothing. Negative controls
 *  (selfcheck-negative.mjs, no Host): drop-one-identity-row / wrong-scope / names-without-identity
 *  MUST FAIL — gate not widened beyond these. */
export function censusExtChecks({ rows }) {
  const census = rows.filter((r) => r.leg === 'census')
  const c = census.length === 1 ? census[0] : {}
  const b2 = rows.find((r) => r.leg === 'body-ran' && r.tag === 'call2')
  const armedCall2 = rows.find((r) => r.leg === 'guard-armed' && r.tag === 'call2')
  const vis = Array.isArray(c.registeredVisibleNames) ? c.registeredVisibleNames : null
  const irows = Array.isArray(c.identity_rows) ? c.identity_rows : null
  const inames = irows === null ? null : irows.map((r) => r.name)
  const exact = irows !== null && vis !== null
    && inames.length === vis.length
    && vis.every((n) => inames.includes(n)) && inames.every((n) => vis.includes(n))
  const fixtureRow = (irows ?? []).find((r) => r.name === TOOL_NAME)
  return {
    census_row_exactly_one: census.length === 1,
    census_no_failed_row: rows.filter((r) => r.leg === 'census-failed').length === 0,
    census_on_control_callid: c.callId !== undefined && b2 !== undefined && c.callId === b2.callId && c.tag === 'call2',
    census_scope_ref_consistent: typeof c.scopeRefId === 'string' && c.scopeRefId === c.schemasScopeRefId && c.scopeRefId === c.getScopeRefId,
    census_identity_rows_exact_correspondence: exact === true,
    census_identity_rows_no_duplicates: inames !== null && new Set(inames).size === inames.length,
    census_identity_rows_all_fields_bound: irows !== null && irows.length >= 1 && irows.every((r) => r.present === true && r.defType === 'object' && typeof r.defRefId === 'string' && typeof r.execRefId === 'string' && typeof r.scopeRefId === 'string' && r.execType === 'function'),
    census_identity_rows_same_scope: irows !== null && irows.length >= 1 && typeof c.scopeRefId === 'string' && irows.every((r) => r.scopeRefId === c.scopeRefId),
    census_repeat_get_reference_stable: irows !== null && irows.length >= 1 && irows.every((r) => r.repeatGetSameRef === true),
    census_fixture_A_calibration_by_eq: fixtureRow?.fixtureCalib?.defIsDefinitionA_by_eq === true && fixtureRow?.fixtureCalib?.execIsDefinitionAExec_by_eq === true,
    census_fixture_defid_matches_guard: fixtureRow !== undefined && armedCall2 !== undefined && typeof armedCall2.approvedFp === 'string' && armedCall2.approvedFp === fixtureRow.defRefId,
    census_registered_visible_includes_fixture: c.visibleIncludesFixture === true && (c.registeredVisibleCount ?? -1) >= 1,
    census_registered_visible_nonempty: vis !== null && vis.length >= 1,
    census_identity_row_count_matches_visible: irows !== null && vis !== null && irows.length === vis.length,
  }
}

/** Census oracle = sealed M3 oracle (imported, unmodified) + census extension checks. */
export function evaluateCensusOracle({ ev, promptRes, sessionId, noTokenStatus, mock, final = false, seeds }) {
  const base = evaluateM3Oracle({ ev, promptRes, sessionId, noTokenStatus, mock, final })
  const rows = readLedger(ev.ledger)
  const ext = censusExtChecks({ rows })
  const c = rows.find((r) => r.leg === 'census')
  const checks = { ...base.checks, ...ext }
  const pass = base.pass && Object.values(ext).every(Boolean)
  return {
    pass, checks, outcome: base.outcome, settled: base.settled, pending: base.pending, final,
    markerFiles: base.markerFiles, bodyRows: base.bodyRows, changeDeliveries: base.changeDeliveries,
    census_row: rows.filter((r) => r.leg === 'census').length === 1 ? c : null,
    seeds_diff: c?.registeredVisibleNames == null ? null : {
      only_in_registered_visible: c.registeredVisibleNames.filter((n) => !seeds.tool_names.includes(n) && n !== TOOL_NAME),
      only_in_seeds_93_union: seeds.tool_names.filter((n) => !c.registeredVisibleNames.includes(n)),
      fixture_off_book: c.registeredVisibleNames.includes(TOOL_NAME) ? [TOOL_NAME] : [],
      surface_obligations_kept_separate: seeds.surface_obligations,
    },
  }
}

export async function runOnceCensus({ port, worldName }) {
  const seeds = JSON.parse(readFileSync(join(HERE, 'seeds-union-offline.json'), 'utf8'))
  const stamp = worldName.slice(WORLD_PREFIX.length)
  const world = validateInputs({ port, worldName })
  const runDir = join(HERE, 'runs', `${WORLD_PREFIX}${stamp}`)
  const ev = { runDir, steps: join(runDir, 'steps.jsonl'), ledger: join(runDir, 'ledger.jsonl'), summary: join(runDir, 'summary.json'), markerDir: join(runDir, 'markers') }
  const deadline = Date.now() + RUN_BUDGET_MS
  const runAbort = new AbortController()
  let timedOut = false; let hardExitTimer
  let instance; let hostChild; let mock; let token; let oracle; let failed = false
  let runError; let promptResSnapshot; let sessionSnapshot; let gateSnapshot
  const remaining = () => deadline - Date.now()
  const recordStep = (step, status, detail) => {
    mkdirSync(ev.runDir, { recursive: true })
    const safe = detail === undefined ? undefined : JSON.parse(scrubSecrets(JSON.stringify(detail), token))
    appendFileSync(ev.steps, JSON.stringify({ at: new Date().toISOString(), step, status, ...(safe !== undefined ? { detail: safe } : {}), budget_left_ms: remaining() }) + '\n')
  }
  const watchdog = setTimeout(() => {
    timedOut = true; failed = true
    try { recordStep('watchdog', 'fail', { reason: 'total run budget exhausted' }) } catch { /* evidence dir may not exist yet */ }
    runAbort.abort(new Error('TIMEOUT: total run budget exhausted'))
    if (hostChild !== undefined && hostChild.exitCode === null && hostChild.signalCode === null) {
      try { hostChild.kill('SIGKILL') } catch { /* verified again in finally */ }
    }
    hardExitTimer = setTimeout(() => { process.exit(1) }, TEARDOWN_STEP_MS * 4).unref()
  }, RUN_BUDGET_MS)
  try {
    for (const c of preflight({ port, worldName })) {
      recordStep('preflight', c.ok ? 'ok' : 'fail', c)
      if (!c.ok) throw new Error(`preflight failed: ${c.check} — ${String(c.detail)}`)
    }
    mkdirSync(join(world, 'profiles', 'web'), { recursive: true })
    mkdirSync(join(world, 'sentinel'), { recursive: true })
    copyFileSync(join(HERE, 'census-probe-plugin.mjs'), join(world, 'profiles', 'web', 's1c-census-plugin.mjs'))
    writeFileSync(join(world, 'sentinel', 's1m1-sentinel.txt'), buildSentinelContent(stamp))
    recordStep('world-skeleton', 'ok', { world })
    instance = new DshInstance({ hostTree: HTU, dshHome: world, port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: ev.runDir })
    instance.mountRows(PROBE_ROWS.map((row) => ({ ...row })), [...PATCH_HEADER_LINES])
    appendFileSync(instance.patchFile, EXT_CONTRIBUTOR_ROWS)
    const patchText = readFileSync(instance.patchFile, 'utf8')
    if (patchText !== buildPatchText()) throw new Error('patch layer mismatch vs buildPatchText()')
    recordStep('patch', 'ok', { sha256: createHash('sha256').update(patchText).digest('hex'), probe: './s1c-census-plugin.mjs', disabled_rows: ['session-log-deepseek', 'plugin-package-inventory-deepseek'], kept: ['deepseek-llm-api-extensions registry row', 'request.signal abort path', 'all tools', 'Guard', 'dispatch'] })
    mkdirSync(ev.markerDir, { recursive: true })
    recordStep('env-scrub', 'ok', { removed_keys: scrubProviderEnv() })
    process.env.DEEPSEEK_BASE_URL = 'http://127.0.0.1:__PORT__'
    process.env.DEEPSEEK_API_KEY = FAKE_KEY
    process.env.S1C_LEDGER = ev.ledger
    process.env.S1C_MARKER_DIR = ev.markerDir
    process.env.S1C_SENTINEL = join(world, 'sentinel', 's1m1-sentinel.txt')
    process.env.S1C_SENTINEL_EXPECT = buildSentinelContent(stamp).trim()
    mock = await startMockModel({ port: 0, decide: makeDecideM3({ promptMarker: CENSUS_PROMPT_MARKER }), log: (m) => recordStep('mock', 'info', m) })
    process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
    recordStep('mock-listen', 'ok', { port: mock.port })
    const startPromise = instance.start({ timeoutMs: Math.min(BOOT_TIMEOUT_MS, remaining()) }) // 1st and ONLY Host start
    hostChild = instance.child
    const booted = await startPromise
    token = new URL(booted.url).searchParams.get('token') ?? undefined
    recordStep('host-boot', 'ok', { owned_pid: hostChild?.pid ?? null, log: booted.logPath, token_fingerprint: token === undefined ? 'absent' : createHash('sha256').update(token).digest('hex').slice(0, 8) })
    const origin = `http://127.0.0.1:${port}`
    const noTokenStatus = await probeNoToken(origin)
    gateSnapshot = noTokenStatus
    recordStep('token-gate', noTokenStatus === 401 ? 'ok' : 'fail', { status: noTokenStatus })
    if (noTokenStatus !== 401) throw new Error(`token gate: expected 401, got ${String(noTokenStatus)}`)
    const cookie = await authenticate(origin, token, runAbort.signal)
    recordStep('authenticate', 'ok')
    const createRes = await apiSessionCreate(origin, cookie, world, 's1c', runAbort.signal)
    recordStep('session-create', createRes.status === 200 ? 'ok' : 'fail', { status: createRes.status, body: createRes.body === null ? null : JSON.stringify(createRes.body).slice(0, 300) })
    if (createRes.status !== 200) throw new Error(`session/create returned ${String(createRes.status)}`)
    const sessionId = JSON.stringify(createRes.body).match(/"sessionId":"([^"]+)"/)?.[1]
    if (typeof sessionId !== 'string') throw new Error('sessionId absent from session/create response')
    sessionSnapshot = sessionId
    const promptRes = await apiPrompt(origin, cookie, sessionId, `s1c ${stamp} ${PROMPT_MARKER}`, 's1c', runAbort.signal)
    recordStep('prompt', promptRes.status === 200 ? 'ok' : 'fail', { status: promptRes.status, body: promptRes.body === null ? null : JSON.stringify(promptRes.body).slice(0, 300) })
    promptResSnapshot = promptRes
    if (promptRes.status !== 200) throw new Error(`session/prompt returned ${String(promptRes.status)}`)
    const waitDeadline = Date.now() + Math.min(PROMPT_WAIT_MS, remaining())
    const sleep = (ms) => new Promise((r) => { setTimeout(r, ms) })
    for (;;) {
      const o = evaluateCensusOracle({ ev, promptRes, sessionId, noTokenStatus, mock, final: false, seeds })
      if (o.settled) { oracle = o; break }
      if (Date.now() >= waitDeadline || remaining() <= 0) { oracle = evaluateCensusOracle({ ev, promptRes, sessionId, noTokenStatus, mock, final: true, seeds }); break }
      await sleep(500)
    }
    recordStep('oracle', oracle.pass ? 'ok' : 'fail', { outcome: oracle.outcome, settled: oracle.settled })
    if (!oracle.pass) failed = true
  } catch (error) {
    failed = true
    runError = scrubSecrets(String(error?.message ?? error), token)
    recordStep('run', 'fail', { error: runError, stack: scrubSecrets(String(error?.stack ?? '').split('\n').slice(0, 4).join(' | '), token) })
    if (mock !== undefined) { try { oracle = evaluateCensusOracle({ ev, promptRes: promptResSnapshot, sessionId: sessionSnapshot, noTokenStatus: gateSnapshot, mock, final: true, seeds }) } catch { /* keep earlier snapshot */ } }
  } finally {
    if (runAbort.signal.aborted) failed = true
    if (instance !== undefined) {
      try { const stopped = await instance.stop({ timeoutMs: Math.min(TEARDOWN_STEP_MS, Math.max(1, remaining())) }); recordStep('teardown-host', 'ok', stopped) } catch (e) { failed = true; recordStep('teardown-host', 'fail', { error: scrubSecrets(String(e?.message ?? e), token) }) }
      if (hostChild !== undefined && hostChild.exitCode === null && hostChild.signalCode === null) {
        failed = true
        try { hostChild.kill('SIGKILL') } catch (e) { recordStep('teardown-host-kill', 'fail', { error: scrubSecrets(String(e?.message ?? e), token) }) }
        const sleep2 = (ms) => new Promise((r) => { setTimeout(r, ms) })
        const exited = await Promise.race([
          new Promise((res) => hostChild.once('close', () => res(true))),
          sleep2(TEARDOWN_STEP_MS).then(() => false),
        ]).catch(() => false)
        const gone = hostChild.exitCode !== null || hostChild.signalCode !== null
        if (!exited || !gone) failed = true
        recordStep('teardown-host', 'fail', { reason: 'owned child alive after instance.stop(); SIGKILL requested', exited_within_bound: exited, handle_reaped: gone })
      }
    }
    if (mock !== undefined) {
      let closeTimer
      try {
        await Promise.race([mock.close(), new Promise((_, rej) => { closeTimer = setTimeout(() => rej(new Error(`TIMEOUT: mock.close after ${TEARDOWN_STEP_MS}ms`)), TEARDOWN_STEP_MS) })])
        recordStep('teardown-mock', 'ok')
      } catch (e) { failed = true; recordStep('teardown-mock', 'fail', { error: scrubSecrets(String(e?.message ?? e), token), note: 'in-process mock released when the runner exits' }) } finally { if (closeTimer !== undefined) clearTimeout(closeTimer) }
    }
    if (instance !== undefined && existsSync(instance.logPath)) {
      try {
        const raw = readFileSync(instance.logPath, 'utf8')
        writeFileSync(`${instance.logPath}.redacted`, scrubSecrets(raw, token), { mode: 0o600 })
        recordStep('redact-log', 'ok', { raw_kept: instance.logPath, redacted: `${instance.logPath}.redacted` })
      } catch (e) { recordStep('redact-log', 'fail', { error: String(e?.message ?? e) }) }
    }
    let free = false
    const sleep3 = (ms) => new Promise((r) => { setTimeout(r, ms) })
    try { free = await Promise.race([waitForPortFree(port, TEARDOWN_STEP_MS), sleep3(TEARDOWN_STEP_MS)]) } catch { free = false }
    if (!free) failed = true
    recordStep('port-recheck', free ? 'ok' : 'fail', { port, in_use: portInUse(port) })
    clearTimeout(watchdog)
    if (hardExitTimer !== undefined) clearTimeout(hardExitTimer)
    recordStep('world-kept', 'info', { world, note: 'kept; deletion forbidden' })
    // Root fix #4 — RUN-bound evidence: this summary must not stand without the binding below.
    const gitOut = (args) => spawnSync('git', ['-C', HTU, ...args], { encoding: 'utf8' }).stdout?.trim() ?? ''
    const worldPatch = join(world, 'profiles', 'web', 'cordis.patch.yml')
    const worldBase = join(world, 'profiles', 'web', 'cordis.yml')
    const worldPlugin = join(world, 'profiles', 'web', 's1c-census-plugin.mjs')
    const censusNames = oracle?.census_row?.registeredVisibleNames ?? null
    const summary = {
      worldName, port, owned_pid: hostChild?.pid ?? null, run_error: runError ?? null,
      run_binding: {
        bound_at: new Date().toISOString(),
        htu: { head: gitOut(['rev-parse', 'HEAD']), porcelain_lines: gitOut(['status', '--porcelain']).split('\n').filter((x) => x !== '').length },
        host_artifacts: {
          HOST_ENTRY: { path: HOST_ENTRY, sha256: existsSync(HOST_ENTRY) ? sha256File(HOST_ENTRY) : null },
          TOOLS_LIB: { path: TOOLS_LIB, sha256: existsSync(TOOLS_LIB) ? sha256File(TOOLS_LIB) : null },
          coverage: 'named build artifacts only — NOT a full-tree hash; build provenance still NOT_VERIFIED (frozen artifact identity only)',
        },
        profile: {
          patch_sha256: existsSync(worldPatch) ? sha256File(worldPatch) : null,
          patch_rows: PROBE_ROWS.map((r) => r.id).concat(['session-log-deepseek:enabled=false', 'plugin-package-inventory-deepseek:enabled=false']),
          base_config: existsSync(worldBase) ? { path: worldBase, sha256: sha256File(worldBase) } : 'none beyond pinned-artifact standard defaults',
          preset_selected: 'none (no preset row; base/standard config only)',
        },
        session_id: sessionSnapshot ?? null,
        fixtures: {
          world_plugin_sha256: existsSync(worldPlugin) ? sha256File(worldPlugin) : null,
          sealed_m3_runner: SEALED_M3_RUNNER_SHA256, sealed_m3_probe: SEALED_M3_PROBE_SHA256,
          sealed_m1_runner: SEALED_M1_RUNNER_SHA256, sealed_m1_probe: SEALED_M1_PROBE_SHA256,
        },
        seeds_union_sha256: SEEDS_UNION_SHA256,
      },
      pass: oracle?.pass === true && !failed, outcome: oracle?.outcome ?? 'not-evaluated',
      oracle: oracle ?? null,
      census: oracle == null ? null : {
        registered_visible_names: censusNames,
        registered_visible_count: oracle.census_row?.registeredVisibleCount ?? null,
        identity_row_count: Array.isArray(oracle.census_row?.identity_rows) ? oracle.census_row.identity_rows.length : null,
        scope_ref_id: oracle.census_row?.scopeRefId ?? null,
        root_call_id: oracle.census_row?.rootCallId ?? null,
        seeds_diff: oracle.seeds_diff,
        surface_obligations_kept_separate: seeds.surface_obligations,
      },
      mode_evidence: {
        model_wire_recorded: mock === undefined ? null : modelPresentedFromMock(mock, 's1m3-tc-1'),
        native_support_this_sample_only: [
          `real direct probe succeeded for the fixture (call2_control_real_output=${String(oracle?.checks?.call2_control_real_output === true)})`,
          `public schemas(scope)/get exclude reserved run_code: ${censusNames === null ? 'not-observed' : String(!censusNames.includes('run_code'))}`,
          'fixed standard/base config of the pinned artifact, no preset row (see run_binding.profile)',
        ],
        limits: 'grounds above support native for THIS sample ONLY; no extrapolation to other modes; nested/guard NOT_TESTED; no private reads; wire shape alone asserts nothing',
      },
      not_tested: ['guard admission for the 86 seed tool names', 'functional execution of any non-fixture tool', 'nested/PTC rule probing (would need foreign bodies)'],
      side_effects_honest: 'fixture marker+read+/bin/echo legs DO write inside the run dir and world (NOT zero-write overall); ledger/steps/log/sentinel writes; loopback mock only, real providers 0',
      failed, timed_out: timedOut, budget_ms: RUN_BUDGET_MS, used_ms: RUN_BUDGET_MS - remaining(),
    }
    mkdirSync(ev.runDir, { recursive: true })
    writeFileSync(ev.summary, JSON.stringify(JSON.parse(scrubSecrets(JSON.stringify(summary), token)), null, 2) + '\n')
  }
  return { pass: oracle?.pass === true && !failed, ev, oracle }
}

async function main() {
  const argv = process.argv.slice(2)
  const go = argv.includes('--go')
  const pi = argv.indexOf('--port')
  const port = pi >= 0 ? Number(argv[pi + 1]) : 3183
  const wi = argv.indexOf('--world')
  const stamp = utcStamp()
  const worldName = wi >= 0 ? String(argv[wi + 1]) : `${WORLD_PREFIX}${stamp}`
  console.log(`# s1-runtime-census launcher — mode=${go ? '--go (SINGLE REAL RUN: 1 Host start, 0 retries)' : '--dry-run (default, read-only)'} port=${String(port)} world=${worldName}`)
  try { validateInputs({ port, worldName }); console.log('  [OK] input validation') } catch (e) { console.log(`  [FAIL] input validation — ${String(e?.message ?? e)}`); process.exit(1) }
  const checks = preflight({ port, worldName })
  for (const c of checks) console.log(`  [${c.ok ? 'OK' : 'FAIL'}] ${c.check}${c.detail !== undefined ? ` — ${String(c.detail).slice(0, 60)}` : ''}`)
  if (checks.some((c) => !c.ok)) { console.log('PREFLIGHT FAILED — fail-closed.'); process.exit(1) }
  const patch = buildPatchText()
  console.log(`\n## profiles/web/cordis.patch.yml (sha256 ${createHash('sha256').update(patch).digest('hex')}):\n${patch}`)
  const seeds = JSON.parse(readFileSync(join(HERE, 'seeds-union-offline.json'), 'utf8'))
  console.log(`## seeds union offline: records=${String(seeds.records)} tools=${String(seeds.tool_count)} surface=${String(seeds.surface_obligations.length)} (kept separate; fixture off-book)`)
  console.log('## decide script: call1 swap arm → call2 restored-A control arm; census = ONE exec.agent ref → schemas(scope) + get(name,scope) (public :1260/:1230).')
  console.log('## scope: census binds registered-visible identity/sets only; guard admission + foreign functional execution stay NOT_TESTED.')
  if (!go) { console.log('\nDRY-RUN: nothing written, no Host started.'); return }
  const { pass } = await runOnceCensus({ port, worldName })
  console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'} (evidence under ${join(HERE, 'runs', worldName)})`)
  process.exit(pass ? 0 : 1)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`FATAL: ${scrubSecrets(String(e?.stack ?? e))}`); process.exit(2) })
}
