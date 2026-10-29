/**
 * s1-h0-m1 / m1-run.mjs — S1 H0-M1 single-run launcher.
 *
 * DEFAULT = --dry-run: READ-ONLY preflight + full printout (world skeleton,
 * patch layer, call graph, env scrub list, oracle). NOTHING is spawned.
 * --go = the ONE authorized execution: single run, 0 retries, exactly ONE Host
 * start, 30-minute watchdog. Any failed step is recorded verbatim and aborts to
 * teardown (fail-closed). Teardown (finally) touches ONLY owned resources:
 * kill own host child -> close own mock -> re-verify own port free -> REDACT the
 * launch token from the instance log (hex8 fingerprint remains). NEVER deletes
 * or mutates the world (root pause) — raw outputs, markers, ledger, inputs stay.
 *
 * Reused existing machinery (byte-identical copies in THIS directory, provenance
 * in inputs.json):
 *   instance.mjs  = 4aaaa7b2:tests/characterization/lib/instance.mjs
 *                   (blob 36ce2e3715c6ba8ce42e6d2eefe0a5906f781dd2,
 *                    sha256 77880a8eec88b874…) — DshInstance.start :79 (fd-stdio
 *                    spawn of `node apps/cli/lib/bin.js web --port P --no-open`,
 *                    boot-marker wait), .stop :128 (kill + waitForPortFree),
 *                    .mountRows :194 (writes the profile patch layer {id,name}
 *                    rows — used here for the single probe row), redactLaunchToken :40.
 *   util.mjs      = 4aaaa7b2:tests/characterization/lib/util.mjs
 *                   (blob 4f0cf580545d59bfc2236532507aafc2f9dac9f9,
 *                    sha256 7dd44280c8b03d7e…) — portInUse/waitForPortFree/logTail.
 *   mock-deepseek.mjs = 4aaaa7b2:packages/tools/harness/mock-deepseek.mjs
 *                   (blob 65ed64e6a9e535af79294a95630b2dadfbaf4e42, sha256 8beade69…).
 *   s1m1-session-client.mjs — fetchJson/authenticate/apiPrompt copied verbatim
 *                   from 4aaaa7b2 a5p1-kit.mjs :257/:266/:279 (blob 6815b41e…);
 *                   apiSessionCreate derived from the same envelope targeting
 *                   @Remote('create') (639ed015 packages/api/session-controller/
 *                   src/index.ts:272-274; request type types.ts:285) — its live
 *                   wire shape is NOT_OBSERVED until the run.
 *
 * --go CALL GRAPH (function-level, for source review):
 *   main -> parseArgs -> validateInputs (port per 4aaaa7b2:tests/paths.mjs:81-93
 *   isSanctionedTestPort semantics; world single-basename + prefix + lstat
 *   symlink/existence refusals) -> preflight (READ-ONLY, same checks as dry-run)
 *   -> runOnce ->
 *        steps(recordStep) ; ensureRunDirs ; writeWorldSkeleton (mkdir,
 *          copyFileSync probe, sentinel write, DshInstance.mountRows patch) ;
 *        startMockModel({port:0,decide}) [mock-deepseek.mjs] ;
 *        scrubProviderEnv() (delete real credential keys from process.env,
 *          then set loopback base url + FAKE key + S1M1_* — DshInstance.start
 *          spawns with {...process.env} at instance.mjs:94 so values propagate) ;
 *        new DshInstance({...}).start() [instance.mjs:79] -> boot URL (token
 *          held IN MEMORY ONLY) ;
 *        probeNoToken===401 [client; kit:750-752 gate] ; authenticate(origin,
 *          token) [kit:266] ; apiSessionCreate [derived envelope] ; sessionId
 *          extracted via findFirstKey ; apiPrompt(text) [kit:279 — POST
 *          /api/session/prompt 'session/prompt', 200 = admitted] ;
 *        poll ledger body-ran + mock record.body tool-result + native termination [capped by watchdog] ;
 *        instance.stop() [kills OWNED child, waits port free] ; mock.close() ;
 *        redactInstanceLog (token -> fp=hex8 of sha256(token)) ;
 *        portInUse recheck [util.mjs] ;
 *        evaluateOracle (ledger/marker/mock/HTTP conjunction — see function).
 *   -> finally: owned teardown + redaction + KEEP world.
 *
 * Budget: 1 experiment / 1 Host start / 0 retries / 30-min watchdog
 * (RUN_BUDGET_MS). Failure stops everything; no retry, no fallback, no cleanup
 * of foreign resources.
 * @module dev/agent-workflow/evidence/s1-h0-m1/m1-run
 */
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  if (signal !== undefined) signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason ?? new Error('aborted')) }, { once: true })
})

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
export const TOOLS_LIB = join(HTU, 'packages', 'core', 'tools', 'lib', 'index.js')
export const MOCK_SHA256_4AAAA = '8beade69588c105efb66df6a7a99dd915cb41b7aba91635ec0ebf73e6278fb06'
export const MOCK_SHA256_HEAD_NOT_USED = 'e0b334901075f881eb946fa0464f80678e5fc8fbba47002878248ed62b9156cf'
export const FAKE_KEY = 's1-m1-mock-key'
/** Ranges + 3080 refusal transcribed from 4aaaa7b2:tests/paths.mjs:81-93
 *  (TEST_PORT_RANGES [[3180,3186],[3491,3500]], STABLE_INSTANCE_PORT=3080,
 *  isSanctionedTestPort: Number.isInteger && !==3080 && in-range). */
export const TEST_PORT_RANGES = Object.freeze([Object.freeze([3180, 3186]), Object.freeze([3491, 3500])])
export const STABLE_INSTANCE_PORT = 3080
export const WORLD_PREFIX = 's1-h0-m1-'
export const RUN_BUDGET_MS = 30 * 60_000
export const TEARDOWN_STEP_MS = 15_000
export const BOOT_TIMEOUT_MS = 90_000
export const PROMPT_WAIT_MS = 180_000
export const TOOL_NAME = 's1_m1_probe'
/** Untriggered NAME — NOT a negative control (unregistered proves no guard
 *  decision); the real cross-generation control belongs to M2. */
export const UNTRIGGERED_NAME = 's1_m1_other'
/** Real provider credential keys deleted from the child env BEFORE spawn
 *  (base patch consumes DEEPSEEK_API_KEY via settings/credentials + the
 *  web row's apiKeyEnv; generic provider keys deleted defensively). Names are
 *  logged; values NEVER are. */
export const SCRUBBED_ENV_KEYS = Object.freeze([
  'DEEPSEEK_API_KEY', 'DEEPSEEK_SEARCH_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 'MISTRAL_API_KEY', 'AZURE_OPENAI_API_KEY',
])

export const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
export const utcStamp = (d = new Date()) => d.toISOString().replace(/[:]/g, '-').replace(/\.\d+Z$/, 'Z')

export function isSanctionedTestPort(port) {
  if (!Number.isInteger(port) || port === STABLE_INSTANCE_PORT) return false
  return TEST_PORT_RANGES.some(([lo, hi]) => port >= lo && port <= hi)
}

/** Hard input validation (#4). Throws on refusal; returns resolved world path. */
export function validateInputs({ port, worldName }) {
  if (!isSanctionedTestPort(port)) throw new Error(`port ${String(port)} rejected (integer, 3180-3186/3491-3500, never ${STABLE_INSTANCE_PORT})`)
  if (typeof worldName !== 'string' || !worldName.startsWith(WORLD_PREFIX)) throw new Error(`world must start with ${WORLD_PREFIX}`)
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(worldName) || worldName.includes('..') || worldName.includes('/') || worldName.includes('\\')) {
    throw new Error(`world name must be a single safe basename (got ${JSON.stringify(worldName)})`)
  }
  const world = join(REPO, 'tests', 'homes', worldName)
  let st
  try { st = lstatSync(world) } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error(`world lstat refused: ${error?.code ?? 'unknown'} — ${error?.message ?? error}`)
  }
  if (st !== undefined) throw new Error(`world path already exists (refusing; symlink=${st.isSymbolicLink()}): ${world}`)
  const homes = join(REPO, 'tests', 'homes')
  let cur = homes
  for (;;) {
    let parent
    try { parent = lstatSync(cur) } catch (error) {
      if (error?.code === 'ENOENT') break
      throw new Error(`path lstat refused: ${error?.code ?? 'unknown'} — ${error?.message ?? error}`)
    }
    if (parent.isSymbolicLink()) throw new Error(`path symlink refused: ${cur}`)
    const next = dirname(cur)
    if (next === cur) break
    cur = next
  }
  const lock = join(REPO, 'tests', 'homes', `${worldName}.lock`)
  try {
    lstatSync(lock)
    throw new Error(`lock ${worldName}.lock exists`)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  return world
}

/** READ-ONLY preflight (same checks dry-run and --go share). */
export function preflight({ port, worldName }) {
  const checks = []
  const add = (check, fn) => {
    try {
      const detail = fn()
      checks.push({ check, ok: detail === undefined, ...(detail !== undefined ? { detail } : {}) })
    } catch (error) {
      checks.push({ check, ok: false, detail: String(error?.message ?? error) })
    }
  }
  add('port-sanctioned', () => (isSanctionedTestPort(port) ? undefined : `port ${String(port)} not sanctioned`))
  add('htu-rev-parse-equals-pin', () => {
    const r = spawnSync('git', ['-C', HTU, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
    const head = String(r.stdout ?? '').trim()
    if (r.status !== 0) return `git rev-parse failed (exit ${String(r.status)})`
    return head === HTU_PIN ? undefined : `HTU HEAD ${head} != pin ${HTU_PIN}`
  })
  add('htu-status-porcelain-empty', () => {
    const r = spawnSync('git', ['-C', HTU, 'status', '--porcelain'], { encoding: 'utf8' })
    if (r.status !== 0) return `git status failed (exit ${String(r.status)})`
    return String(r.stdout ?? '').trim() === '' ? undefined : 'HTU working tree not clean'
  })
  add('htu-entry-exists', () => (existsSync(HOST_ENTRY) ? undefined : `missing ${HOST_ENTRY}`))
  add('htu-tools-lib-exists', () => (existsSync(TOOLS_LIB) ? undefined : `missing ${TOOLS_LIB}`))
  add('bin-echo-exists', () => (existsSync('/bin/echo') && lstatSync('/bin/echo').isFile() ? undefined : '/bin/echo missing'))
  add('host-port-free-per-proc-net', () => {
    const ports = procNetPorts()
    return ports.has(port) ? `port ${port} present in /proc/net/tcp{,6}` : undefined
  })
  add('mock-copy-matches-4aaaa-blob', () => {
    const got = sha256File(join(HERE, 'mock-deepseek.mjs'))
    if (got === MOCK_SHA256_HEAD_NOT_USED) return 'local mock is the HEAD version (forbidden)'
    return got === MOCK_SHA256_4AAAA ? undefined : `mock sha256 ${got} != ${MOCK_SHA256_4AAAA}`
  })
  return checks
}

export function procNetPorts() {
  const ports = new Set()
  for (const f of ['/proc/net/tcp', '/proc/net/tcp6']) {
    if (!existsSync(f)) continue
    for (const line of readFileSync(f, 'utf8').split('\n').slice(1)) {
      const local = line.trim().split(/\s+/)[1]
      const hex = local?.split(':')[1]
      if (hex !== undefined) ports.add(parseInt(hex, 16))
    }
  }
  return ports
}

/** Configuration-control variants (root-approved differential probe, default = audited v5 behaviour). */
export const VARIANT_FLAG = '--variant-no-ext-contributors'
export const VARIANT_DEFAULT = 'default'
export const VARIANT_NO_EXT = 'no-ext-contributors'
/** Public config layers: disable only the two pre-HTTP metadata contributors, via their own `enabled` flag. */
export const EXT_CONTRIBUTOR_ROWS = [
  '# Variant layer (public profile-patch composition, root-authorized differential probe):',
  '# disables ONLY the two deepseekLlmApiExtensions metadata contributors through their own',
  '# public config flag — syntax precedent at apps/cli/tests/profiles/headless/goal-snapshot.patch.yml:28-30',
  '# (id + config.enabled:false); schemas: session-log-deepseek/src/index.ts:51-52,',
  '# plugin-package-inventory-deepseek/src/index.ts:38-39. NOT a private map, NOT a monkeypatch,',
  '# NOT disabling the registry row (deepseek-llm-api-extensions stays mounted; base/cordis.patch.yml:37-38),',
  '# so registry + request.signal abort (deepseek-llm-api-extensions/src/index.ts:109-114) and every',
  '# tool / Guard / dispatch path remain in effect.',
  '- id: session-log-deepseek',
  '  config:',
  '    enabled: false',
  '- id: plugin-package-inventory-deepseek',
  '  config:',
  '    enabled: false',
  '',
].join('\n')
export function parseVariant(argv) {
  return argv.includes(VARIANT_FLAG) ? VARIANT_NO_EXT : VARIANT_DEFAULT
}
export function buildPatchText(variant = VARIANT_DEFAULT) {
  // Byte-identical to DshInstance.mountRows([{id,name}], header) output
  // (instance.mjs:194-209): '- insert:' + `    - id:` + `      name: JSON-string`.
  const base = [
    '# S1 H0-M1: ONE plain plugin row via the public profile-patch seam (written by DshInstance.mountRows).',
    '# Relative name resolves beside this patch file (app-boot/src/index.ts:532,:994 @639ed015).',
    '# No preset, no Team row, no PR360 assembly.',
    '- insert:',
    '    - id: s1m1-probe',
    '      name: "./s1m1-probe-plugin.mjs"',
    '',
  ].join('\n')
  if (variant === VARIANT_DEFAULT) return base
  if (variant !== VARIANT_NO_EXT) throw new Error(`unknown variant: ${String(variant)}`)
  return `${base}${EXT_CONTRIBUTOR_ROWS}`
}

export function buildSentinelContent(stamp) {
  return `s1m1-sentinel-ok-${stamp}\n`
}

export function buildEvidencePlan({ stamp }) {
  const run = join(HERE, 'runs', WORLD_PREFIX + stamp)
  return { runDir: run, markerDir: join(run, 'markers'), ledger: join(run, 'ledger.jsonl'), steps: join(run, 'steps.jsonl'), summary: join(run, 'summary.json') }
}

/** decide(): first model request -> ONE tool call {tag:'A1'}; then text wrap-up. */
export function makeDecide() {
  return ({ seq }) => {
    if (seq === 1) return { kind: 'tool-call', toolCalls: [{ id: 's1m1-tc-1', name: TOOL_NAME, arguments: { tag: 'A1' } }] }
    return { kind: 'text', content: 's1-m1-complete' }
  }
}

export function scrubProviderEnv() {
  const removed = []
  for (const key of SCRUBBED_ENV_KEYS) {
    if (process.env[key] !== undefined) { delete process.env[key]; removed.push(key) }
  }
  return removed // names only; values never leave this function
}

function findFirstKey(value, key) {
  if (value === null || typeof value !== 'object') return undefined
  if (!Array.isArray(value) && typeof value[key] === 'string') return value[key]
  for (const inner of Object.values(value)) {
    const got = findFirstKey(inner, key)
    if (got !== undefined) return got
  }
  return undefined
}

function readLedger(path) {
  if (!existsSync(path)) return []
  const rows = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim() === '') continue
    try { rows.push(JSON.parse(line)) } catch { /* raw text preserved in file; unparseable lines fail the oracle via missing rows */ }
  }
  return rows
}

function terminalReply(record) {
  if (record?.status !== 200 || !Array.isArray(record?.sent)) return false
  if (String(record.path ?? '').split('?')[0] === '/v1/messages') {
    const delta = record.sent.find((x) => x?.type === 'message_delta' && ['tool_use', 'end_turn'].includes(x?.delta?.stop_reason))
    const stop = record.sent.some((x) => x?.type === 'message_stop')
    return delta !== undefined && stop
  }
  // Mechanical fix (root ruling): the pinned mock writes `data: [DONE]` straight to the
  // socket (mock-deepseek.mjs:357,:376) and only pushes OBJECTS into record.sent (:292),
  // so a recorded '[DONE]' element can never exist. This mock also sets record.status = 200
  // AFTER writing [DONE], so the observable native termination on /chat/completions is:
  // status 200 (checked above) + a real terminal `finish_reason: 'stop'` inside sent[].
  // reply.kind === 'text' for the result-carrying request is enforced by the callers.
  return record.sent.some((x) => x?.choices?.some?.((c) => c?.finish_reason === 'stop'))
}

function toolResultFrom(value) {
  const messages = Array.isArray(value?.messages) ? value.messages : []
  for (const message of messages) {
    if (message?.role === 'tool' && message.tool_call_id === 's1m1-tc-1') return message
    for (const part of Array.isArray(message?.content) ? message.content : []) {
      if (part?.type === 'tool_result' && part.tool_use_id === 's1m1-tc-1') return part
    }
  }
  return undefined
}

function validToolResult(request) {
  const result = toolResultFrom(request?.body)
  if (result === undefined || result.is_error === true) return false
  const text = typeof result.content === 'string' ? result.content : (Array.isArray(result.content) ? result.content.find((x) => typeof x?.text === 'string')?.text : undefined)
  if (typeof text !== 'string') return false
  try { const parsed = JSON.parse(text); return parsed?.ran === true && parsed?.tag === 'A1' && Array.isArray(parsed?.failed) && parsed.failed.length === 0 } catch { return false }
}

/** Ledger-first PASS conjunction (#2). FAIL = any false; raw evidence kept. */
export function evaluateOracle({ ev, stamp, promptRes, sessionId, noTokenStatus, mock, callSettled = false, resultReturned = false }) {
  const rows = readLedger(ev.ledger)
  const body = rows.filter((r) => r.leg === 'body-ran' && r.tool === TOOL_NAME)
  const markers = existsSync(ev.markerDir) ? readdirSync(ev.markerDir) : []
  const otherHits = rows.filter((r) => JSON.stringify(r).includes(UNTRIGGERED_NAME))
  const markerOther = markers.filter((m) => m.includes('other'))
  const mockReq = mock?.requests ?? []
  const resultIndex = mockReq.findIndex(validToolResult)
  const resultRequest = resultIndex >= 0 ? mockReq[resultIndex] : undefined
  const checks = {
    register_ok_once: rows.filter((r) => r.leg === 'register' && r.ok === true).length === 1,
    body_ran_exactly_once: body.length === 1,
    body_ran_true_and_tag_A1: body.length === 1 && body[0].ran === true && body[0].tag === 'A1' && Array.isArray(body[0].failed) && body[0].failed.length === 0,
    marker_A1_exists_and_only: markers.length === 1 && markers[0] === 'A1.marker',
    read_leg_ok: rows.some((r) => r.leg === 'read-ran' && r.ok === true && r.tag === 'A1'),
    process_leg_ok: rows.some((r) => r.leg === 'process-ran' && r.ok === true && r.echoOut === 's1m1-process-leg A1'),
    prompt_admitted_200: promptRes?.status === 200,
    session_created: typeof sessionId === 'string' && sessionId.length > 0,
    token_gate_401: noTokenStatus === 401,
    mock_two_requests: mockReq.length >= 2,
    call_terminal_determined: callSettled,
    tool_result_returned: resultReturned,
    tool_result_round_tripped: callSettled && resultReturned && resultRequest !== undefined && resultRequest.reply?.kind === 'text' && terminalReply(resultRequest),
    untriggered_name_zero: otherHits.length === 0 && markerOther.length === 0, // untriggered NAME check, NOT a control (M2)
  }
  const pass = Object.values(checks).every(Boolean)
  return { pass, checks, counts: { body_ran: body.length, markers: markers.length, untriggered_rows: otherHits.length }, stamp }
}

export function scrubSecrets(value, token = undefined) {
  const fp = token === undefined ? 'unknown' : createHash('sha256').update(token).digest('hex').slice(0, 8)
  const text = String(value ?? '')
  const known = token === undefined ? text : text.split(token).join(`<REDACTED-TOKEN fp=${fp}>`)
  return known.replace(/([?&]token=)[A-Za-z0-9_-]+/g, `$1<REDACTED-TOKEN fp=${fp}>`)
}

function redactInstanceLog(logPath, token) {
  if (logPath === undefined || !existsSync(logPath)) return false
  const text = readFileSync(logPath, 'utf8')
  writeFileSync(logPath, scrubSecrets(text, token))
  return true
}

/** THE single run. Never called by --dry-run. */
export async function runOnce({ port, worldName, variant = VARIANT_DEFAULT }) {
  const stamp = worldName.slice(WORLD_PREFIX.length)
  const world = validateInputs({ port, worldName })
  const ev = buildEvidencePlan({ stamp })
  const deadline = Date.now() + RUN_BUDGET_MS
  const runAbort = new AbortController()
  let timedOut = false
  let hardExitTimer
  const watchdog = setTimeout(() => {
    // Real supervisor expiry: mark failure, abort in-flight awaits, terminate the owned
    // handle if one already exists, and arm a BOUNDED last exit in case teardown itself hangs.
    timedOut = true
    failed = true
    try { recordStep('watchdog', 'fail', { reason: 'total run budget exhausted' }) } catch { /* evidence dir may not exist yet */ }
    runAbort.abort(new Error('TIMEOUT: total run budget exhausted'))
    if (hostChild !== undefined && hostChild.exitCode === null && hostChild.signalCode === null) {
      try { hostChild.kill('SIGKILL') } catch { /* verified again in finally */ }
    }
    hardExitTimer = setTimeout(() => {
      try { recordStep('hard-exit', 'fail', { reason: 'teardown did not settle within the bounded grace; exiting runner (releases the in-process mock)' }) } catch { /* best effort */ }
      process.exit(1)
    }, TEARDOWN_STEP_MS * 4).unref()
  }, RUN_BUDGET_MS)
  const remaining = () => deadline - Date.now()
  const recordStep = (step, status, detail) => {
    mkdirSync(ev.runDir, { recursive: true })
    const safeDetail = detail === undefined ? undefined : JSON.parse(scrubSecrets(JSON.stringify(detail), token))
    appendFileSync(ev.steps, JSON.stringify({ at: new Date().toISOString(), step, status, ...(safeDetail !== undefined ? { detail: safeDetail } : {}), budget_left_ms: remaining() }) + '\n')
  }
  let instance
  let hostChild
  let mock
  let token
  let oracle
  let failed = false
  try {
    for (const c of preflight({ port, worldName })) {
      recordStep('preflight', c.ok ? 'ok' : 'fail', c)
      if (!c.ok) throw new Error(`preflight failed: ${c.check} — ${String(c.detail)}`)
    }
    // world skeleton (created only now, never deleted)
    mkdirSync(join(world, 'profiles', 'web'), { recursive: true })
    mkdirSync(join(world, 'sentinel'), { recursive: true })
    copyFileSync(join(HERE, 'probe-plugin.mjs'), join(world, 'profiles', 'web', 's1m1-probe-plugin.mjs'))
    writeFileSync(join(world, 'sentinel', 's1m1-sentinel.txt'), buildSentinelContent(stamp))
    recordStep('world-skeleton', 'ok', { world })
    instance = new DshInstance({ hostTree: HTU, dshHome: world, port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: ev.runDir })
    instance.mountRows([{ id: 's1m1-probe', name: './s1m1-probe-plugin.mjs' }], [
      'S1 H0-M1: ONE plain plugin row via the public profile-patch seam (written by DshInstance.mountRows).',
      'Relative name resolves beside this patch file (app-boot/src/index.ts:532,:994 @639ed015).',
      'No preset, no Team row, no PR360 assembly.',
    ])
    recordStep('mount-rows', 'ok', { patchFile: instance.patchFile })
    if (variant !== VARIANT_DEFAULT) {
      // Configuration control only: append the public config layers to the same profile patch file.
      appendFileSync(instance.patchFile, EXT_CONTRIBUTOR_ROWS)
    }
    const patchText = readFileSync(instance.patchFile, 'utf8')
    if (patchText !== buildPatchText(variant)) throw new Error(`patch layer mismatch for variant ${variant}`)
    recordStep('patch-variant', 'ok', {
      variant,
      sha256: createHash('sha256').update(patchText).digest('hex'),
      disabled_rows: variant === VARIANT_NO_EXT ? ['session-log-deepseek', 'plugin-package-inventory-deepseek'] : [],
      kept: ['deepseek-llm-api-extensions registry row', 'request.signal abort path', 'all tools', 'Guard', 'dispatch'],
    })
    mkdirSync(ev.markerDir, { recursive: true })
    const removed = scrubProviderEnv()
    recordStep('env-scrub', 'ok', { removed_keys: removed })
    process.env.DEEPSEEK_BASE_URL = 'http://127.0.0.1:__PORT__' // placeholder; set after mock listens
    process.env.DEEPSEEK_API_KEY = FAKE_KEY
    process.env.S1M1_LEDGER = ev.ledger
    process.env.S1M1_MARKER_DIR = ev.markerDir
    process.env.S1M1_SENTINEL = join(world, 'sentinel', 's1m1-sentinel.txt')
    process.env.S1M1_SENTINEL_EXPECT = buildSentinelContent(stamp).trim()
    mock = await startMockModel({ port: 0, decide: makeDecide(), log: (m) => recordStep('mock', 'info', m) })
    process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}` // loopback only
    recordStep('mock-listen', 'ok', { port: mock.port })
    // start() spawns synchronously before its first await (instance.mjs:87 spawn, :105 this.child
    // assigned, first await at :117 waitForLogLine) — so calling it, capturing the owned handle
    // immediately, and only then awaiting keeps a real ChildProcess handle even when boot fails.
    const startPromise = instance.start({ timeoutMs: Math.min(BOOT_TIMEOUT_MS, remaining()) }) // 1st and ONLY Host start
    hostChild = instance.child // owned handle captured BEFORE the first await
    const booted = await startPromise
    token = new URL(booted.url).searchParams.get('token') ?? undefined // memory only
    recordStep('host-boot', 'ok', { log: booted.logPath, token_fingerprint: token === undefined ? 'absent' : createHash('sha256').update(token).digest('hex').slice(0, 8) })
    const origin = `http://127.0.0.1:${port}`
    const noTokenStatus = await probeNoToken(origin)
    recordStep('token-gate', noTokenStatus === 401 ? 'ok' : 'fail', { status: noTokenStatus })
    if (noTokenStatus !== 401) throw new Error(`token gate: expected 401 without token, got ${String(noTokenStatus)}`)
    const cookie = await authenticate(origin, token, runAbort.signal)
    recordStep('authenticate', 'ok')
    const createRes = await apiSessionCreate(origin, cookie, world, 's1m1', runAbort.signal)
    recordStep('session-create', createRes.status === 200 ? 'ok' : 'fail', { status: createRes.status, body: createRes.body === null ? null : JSON.stringify(createRes.body).slice(0, 400) })
    if (createRes.status !== 200) throw new Error(`session/create returned ${String(createRes.status)}`)
    const sessionId = findFirstKey(createRes.body, 'sessionId')
    if (typeof sessionId !== 'string') throw new Error('sessionId absent from session/create response')
    const promptRes = await apiPrompt(origin, cookie, sessionId, `s1m1 M1 positive-control prompt ${stamp}`, 's1m1', runAbort.signal)
    recordStep('prompt', promptRes.status === 200 ? 'ok' : 'fail', { status: promptRes.status, body: promptRes.body === null ? null : JSON.stringify(promptRes.body).slice(0, 300) })
    if (promptRes.status !== 200) throw new Error(`session/prompt returned ${String(promptRes.status)}`)
    const waitDeadline = Date.now() + Math.min(PROMPT_WAIT_MS, remaining())
    let callSettled = false
    let resultReturned = false
    for (;;) {
      const rows = readLedger(ev.ledger)
      const body = rows.filter((r) => r.leg === 'body-ran' && r.tool === TOOL_NAME)
      const resultRequest = mock.requests.find(validToolResult)
      const result = resultRequest !== undefined && resultRequest.reply?.kind === 'text' && terminalReply(resultRequest)
      const terminal = mock.requests.length >= 2 && mock.requests.every((r) => r.status !== null || r.error !== null)
      if (body.length === 1 && result && terminal) { callSettled = true; resultReturned = true; break }
      if (Date.now() >= waitDeadline || remaining() <= 0) throw new Error('TIMEOUT: tool call/result terminal state not observed')
      await sleep(500, runAbort.signal)
    }
    oracle = evaluateOracle({ ev, stamp, promptRes, sessionId, noTokenStatus, mock, callSettled, resultReturned })
  } catch (error) {
    failed = true
    recordStep('run', 'fail', { error: scrubSecrets(String(error?.message ?? error), token), stack: scrubSecrets(String(error?.stack ?? '').split('\n').slice(0, 4).join(' | '), token) })
  } finally {
    if (runAbort.signal.aborted) failed = true
    if (instance !== undefined) {
      try { const stopped = await instance.stop({ timeoutMs: Math.min(TEARDOWN_STEP_MS, Math.max(1, remaining())) }); recordStep('teardown-host', 'ok', stopped) } catch (e) { failed = true; recordStep('teardown-host', 'fail', { error: scrubSecrets(String(e?.message ?? e), token) }) }
      if (hostChild !== undefined && hostChild.exitCode === null && hostChild.signalCode === null) {
        failed = true
        try { hostChild.kill('SIGKILL') } catch (e) { recordStep('teardown-host-kill', 'fail', { error: scrubSecrets(String(e?.message ?? e), token) }) }
        // BOUNDED verification that the SIGKILL'd owned handle really went away (not just signalled).
        const exited = await Promise.race([
          new Promise((resolveExit) => hostChild.once('close', () => resolveExit(true))),
          sleep(TEARDOWN_STEP_MS).then(() => false),
        ]).catch(() => false)
        const gone = hostChild.exitCode !== null || hostChild.signalCode !== null
        if (!exited || !gone) failed = true
        recordStep('teardown-host', 'fail', {
          reason: 'owned child remained alive after instance.stop(); SIGKILL requested',
          exited_within_bound: exited,
          handle_reaped: gone,
          exit_code: hostChild.exitCode,
          signal_code: hostChild.signalCode,
        })
      }
    }
    if (mock !== undefined) {
      let closeTimer
      try {
        await Promise.race([mock.close(), new Promise((_, reject) => { closeTimer = setTimeout(() => reject(new Error(`TIMEOUT: mock.close after ${TEARDOWN_STEP_MS}ms`)), TEARDOWN_STEP_MS) })])
        recordStep('teardown-mock', 'ok')
      } catch (e) { failed = true; recordStep('teardown-mock', 'fail', { error: scrubSecrets(String(e?.message ?? e), token), note: 'the in-process mock is released when this runner exits' }) }
      finally { if (closeTimer !== undefined) clearTimeout(closeTimer) }
    }
    if (instance !== undefined) {
      const redacted = redactInstanceLog(instance.logPath, token)
      recordStep('redact-log', redacted ? 'ok' : 'noop')
      let free = false
      try { free = await Promise.race([waitForPortFree(port, TEARDOWN_STEP_MS), sleep(TEARDOWN_STEP_MS)]) } catch { free = false }
      if (!free) failed = true
      recordStep('port-recheck', free ? 'ok' : 'fail', { port, in_use: portInUse(port) })
    }
    // Supervision stays armed through all owned termination; it is disarmed only once
    // every owned resource has been dealt with, immediately before the summary is written.
    clearTimeout(watchdog)
    if (hardExitTimer !== undefined) clearTimeout(hardExitTimer)
    recordStep('world-kept', 'info', { world, note: 'deletion forbidden (root pause)' })
    const summary = { worldName, port, variant, pass: oracle?.pass === true && !failed, oracle: oracle ?? null, failed, timed_out: timedOut, budget_ms: RUN_BUDGET_MS, used_ms: RUN_BUDGET_MS - remaining() }
    const safeSummary = JSON.parse(scrubSecrets(JSON.stringify(summary), token))
    mkdirSync(ev.runDir, { recursive: true })
    writeFileSync(ev.summary, JSON.stringify(safeSummary, null, 2) + '\n')
    // NOTE: no cleanup of the world; raw outputs/markers/ledger/steps/summary kept.
  }
  return { pass: oracle?.pass === true && !failed, ev, oracle }
}

async function main() {
  const argv = process.argv.slice(2)
  const go = argv.includes('--go')
  const portIdx = argv.indexOf('--port')
  const port = portIdx >= 0 ? Number(argv[portIdx + 1]) : 3180
  const worldIdx = argv.indexOf('--world')
  const stamp = utcStamp()
  const worldName = worldIdx >= 0 ? String(argv[worldIdx + 1]) : `${WORLD_PREFIX}${stamp}`

  console.log(`# s1-h0-m1 launcher — mode=${go ? '--go (SINGLE REAL RUN: 1 host start, 0 retries, 30-min watchdog)' : '--dry-run (default, read-only)'} port=${String(port)} world=${worldName}`)
  try {
    validateInputs({ port, worldName })
    console.log('  [OK] input validation (sanctioned port; world prefix+basename; no existing path/symlink; no lock)')
  } catch (error) {
    console.log(`  [FAIL] input validation — ${String(error?.message ?? error)}`)
    process.exit(1)
  }
  const checks = preflight({ port, worldName })
  for (const c of checks) console.log(`  [${c.ok ? 'OK' : 'FAIL'}] ${c.check}${c.detail !== undefined ? ` — ${c.detail}` : ''}`)
  if (checks.some((c) => !c.ok)) { console.log('PREFLIGHT FAILED — fail-closed.'); process.exit(1) }

  const ev = buildEvidencePlan({ stamp: worldName.slice(WORLD_PREFIX.length) })
  const variant = parseVariant(argv)
  console.log(`\n## variant: ${variant}${variant === VARIANT_NO_EXT ? ' (config control: two metadata contributors disabled via public config.enabled:false; registry/abort/tools/Guard/dispatch kept)' : ' (audited v5 default patch, unchanged)'}  flag: ${VARIANT_FLAG}`)
  console.log('\n## profiles/web/cordis.patch.yml (written by DshInstance.mountRows — instance.mjs:194' + (variant === VARIANT_NO_EXT ? ' + appended public config layers' : '') + '):\n' + buildPatchText(variant))
  console.log(`## patch sha256: ${createHash('sha256').update(buildPatchText(variant)).digest('hex')}`)
  console.log(`## sentinel/s1m1-sentinel.txt:\n${buildSentinelContent(worldName.slice(WORLD_PREFIX.length))}`)
  console.log('## env scrubbed (names only) before spawn:', SCRUBBED_ENV_KEYS.join(', '))
  console.log('## env injected:', 'DEEPSEEK_BASE_URL=http://127.0.0.1:<mockPort> DEEPSEEK_API_KEY=<fake> S1M1_LEDGER S1M1_MARKER_DIR S1M1_SENTINEL S1M1_SENTINEL_EXPECT DSH_HOME DSH_CLIENT_COMMIT_HASH=639ed01539')
  console.log('## mock decide: seq1 -> toolCall ' + TOOL_NAME + "{tag:'A1'}; seq>1 -> text 's1-m1-complete'")
  console.log('## oracle (ledger-first PASS):', 'register_ok_once, body_ran_exactly_once, ran+tag+failed, marker A1 only, read_leg_ok, process_leg_ok, prompt 200, session created, 401 gate, >=2 mock requests, tool_result round-trip, untriggered-name zero (NOT a control)')
  console.log(`## teardown (finally, owned only): instance.stop() -> mock.close() -> redact token(fp=hex8) -> port recheck -> KEEP world/runs (${ev.runDir})`)

  if (!go) {
    console.log('\n--dry-run: nothing spawned, nothing written outside this evidence directory. Use --go only in the authorized round.')
    return
  }
  const { pass } = await runOnce({ port, worldName, variant })
  console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'} (raw evidence under ${ev.runDir})`)
  process.exit(pass ? 0 : 1)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`FATAL: ${scrubSecrets(String(error?.stack ?? error))}`)
    process.exit(2)
  })
}
