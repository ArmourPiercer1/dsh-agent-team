/**
 * S1 H0-M2 runner — independent SMALL runner for the tools/execute fence experiment.
 *
 * It reuses the audited H0-M1 helpers by import (instance/util/mock/session-client and the pure
 * helpers exported by m1-run.mjs). The sealed M1 runner is NOT modified: this runner's preflight
 * asserts its bytes are still 4542782e71d2b73b2f54e67c812b4ce945cd9d93fc0312f9dfcd5c882bfb07f0.
 *
 * Experiment (root-authorized, one bounded attempt):
 *   call #1 — inside the public `tools/execute` fence, the plugin unregisters Definition A and
 *             registers same-name Definition B (identical parameters + identical VALID output
 *             schema; only the body differs), then awaits next().
 *   call #2 — control: no swap, A has been restored, so A must run.
 *   Measurement: which body ran per rootCallId (marker file name + callID-bound ledger rows),
 *   whether both results were delivered to the model, and the three tool legs (marker/read/echo).
 *
 * Scope limits written into the summary: a B run proves LATE RESOLUTION ONLY. It is not a safety
 * PASS and not an authorization bypass — no authorization check in this pipeline is bound to
 * A's identity (packages/core/tools/src/index.ts:1493-1519, :700-711 decide by name/arguments).
 * Running A, zero bodies, and undelivered results are recorded as distinct outcomes; PASS is
 * only ever the late-resolution + control pair.
 *
 * Default mode is --dry-run (read-only). Real run requires --go (root GO only): 1 Host start,
 * 0 retries, 30-min watchdog, bounded owned teardown, loopback mock only.
 * @module dev/agent-workflow/evidence/s1-h0-m2/m2-run
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { basename, join, resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BOOT_TIMEOUT_MS, CLIENT_COMMIT_HASH, EXT_CONTRIBUTOR_ROWS, FAKE_KEY, HOST_ENTRY, HTU, HTU_PIN,
  MOCK_SHA256_4AAAA, PROMPT_WAIT_MS, RUN_BUDGET_MS, SCRUBBED_ENV_KEYS, STABLE_INSTANCE_PORT,
  TEARDOWN_STEP_MS, TEST_PORT_RANGES, TOOLS_LIB, TOOL_NAME, UNTRIGGERED_NAME, buildSentinelContent,
  isSanctionedTestPort, procNetPorts, scrubProviderEnv, scrubSecrets, sha256File, utcStamp,
} from '../s1-h0-m1/m1-run.mjs'
import { DshInstance } from '../s1-h0-m1/instance.mjs'
import { portInUse, waitForPortFree } from '../s1-h0-m1/util.mjs'
import { startMockModel } from '../s1-h0-m1/mock-deepseek.mjs'
import { apiPrompt, apiSessionCreate, authenticate, probeNoToken } from '../s1-h0-m1/s1m1-session-client.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const M1_DIR = resolve(HERE, '..', 's1-h0-m1')
export const WORLD_PREFIX = 's1-h0-m2-'
export const SEALED_M1_RUNNER_SHA256 = '4542782e71d2b73b2f54e67c812b4ce945cd9d93fc0312f9dfcd5c882bfb07f0'
export const SEALED_M1_PROBE_SHA256 = 'c883ac3f80efcfe4a4fe462b137f32cbfc1724fafb0662d19c92848a8618f195'
export const TC1 = 's1m2-tc-1'
export const TC2 = 's1m2-tc-2'
const PROMPT_MARKER = 'S1M2-FENCE-PROMPT'
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms) })

export function validateInputs({ port, worldName }) {
  if (!Number.isInteger(port) || !isSanctionedTestPort(port) || port === STABLE_INSTANCE_PORT) throw new Error(`port ${String(port)} rejected (sanctioned test ranges only; :${String(STABLE_INSTANCE_PORT)} forbidden)`)
  if (!worldName.startsWith(WORLD_PREFIX)) throw new Error(`world must start with ${WORLD_PREFIX}`)
  if (basename(worldName) !== worldName || worldName.includes('..') || !/^s1-h0-m2-[A-Za-z0-9._-]+$/.test(worldName)) throw new Error(`world must be a single safe basename (got ${worldName})`)
  const world = join(HTU, '..', 'homes', worldName)
  if (existsSync(world)) throw new Error(`world path already exists: ${world}`)
  if (existsSync(`${world}.lock`)) throw new Error(`world lock already exists: ${world}.lock`)
  return world
}

export function preflight({ port, worldName }) {
  const git = (args) => spawnSync('git', ['-C', HTU, ...args], { encoding: 'utf8' }).stdout?.trim() ?? ''
  return [
    { check: 'port-sanctioned', ok: isSanctionedTestPort(port) && port !== STABLE_INSTANCE_PORT, detail: String(port) },
    { check: 'htu-rev-parse-equals-pin', ok: git(['rev-parse', 'HEAD']) === HTU_PIN, detail: git(['rev-parse', 'HEAD']).slice(0, 12) },
    { check: 'htu-status-porcelain-empty', ok: git(['status', '--porcelain']) === '', detail: git(['status', '--porcelain']).split('\n').filter((x) => x !== '').length },
    { check: 'htu-entry-exists', ok: existsSync(HOST_ENTRY), detail: HOST_ENTRY },
    { check: 'htu-tools-lib-exists', ok: existsSync(TOOLS_LIB), detail: TOOLS_LIB },
    { check: 'bin-echo-exists', ok: existsSync('/bin/echo'), detail: '/bin/echo' },
    { check: 'host-port-free-per-proc-net', ok: !procNetPorts().has(port), detail: String(port) },
    { check: 'm2-probe-exists', ok: existsSync(join(HERE, 'probe-m2-plugin.mjs')), detail: 'probe-m2-plugin.mjs' },
    { check: 'm1-sealed-runner-bytes-unchanged', ok: sha256File(join(M1_DIR, 'm1-run.mjs')) === SEALED_M1_RUNNER_SHA256, detail: sha256File(join(M1_DIR, 'm1-run.mjs')).slice(0, 16) },
    { check: 'm1-sealed-probe-unchanged', ok: sha256File(join(M1_DIR, 'probe-plugin.mjs')) === SEALED_M1_PROBE_SHA256, detail: sha256File(join(M1_DIR, 'probe-plugin.mjs')).slice(0, 16) },
    { check: 'mock-copy-matches-4aaaa-blob', ok: sha256File(join(M1_DIR, 'mock-deepseek.mjs')) === MOCK_SHA256_4AAAA, detail: sha256File(join(M1_DIR, 'mock-deepseek.mjs')).slice(0, 16) },
    { check: 'world-absent', ok: !existsSync(join(HTU, '..', 'homes', worldName)), detail: worldName },
  ]
}

export function buildEvidencePlan({ stamp }) {
  const runDir = join(HERE, 'runs', `${WORLD_PREFIX}${stamp}`)
  return { runDir, steps: join(runDir, 'steps.jsonl'), ledger: join(runDir, 'ledger.jsonl'), summary: join(runDir, 'summary.json'), markerDir: join(runDir, 'markers') }
}

/** The M2 patch layer: ONE plain plugin row (the M2 probe) + the two public config layers
 *  carried over from the no-ext variant, byte-appended exactly as the M1 runner appends them. */
/** Single source of truth for the mounted row and the patch header (bare lines; mountRows adds
 *  the single '# ' prefix itself — instance.mjs:196-201). */
export const PROBE_ROWS = Object.freeze([{ id: 's1m2-probe', name: './s1m2-probe-plugin.mjs' }])
export const PATCH_HEADER_LINES = Object.freeze([
  'S1 H0-M2: ONE plain plugin row via the public profile-patch seam (written by DshInstance.mountRows).',
  'Relative name resolves beside this patch file (app-boot/src/index.ts:532,:994 @639ed015).',
  'No preset, no Team row, no PR360 assembly.',
])

export function buildPatchText() {
  // mountRows (instance.mjs:196-197) prefixes each header line with '# ' ITSELF:
  // these strings must stay bare, and the byte equality is asserted against the real helper's
  // output in selfcheck/patch-bytes.mjs (no Host).
  const header = PATCH_HEADER_LINES.map((l) => `# ${l}`).join('\n')
  const insert = ['- insert:', ...PROBE_ROWS.flatMap((row) => [`    - id: ${row.id}`, `      name: ${JSON.stringify(row.name)}`]), ''].join('\n')
  return `${header}\n${insert}${EXT_CONTRIBUTOR_ROWS}`
}

/** decide({ seq, req }) per mock-deepseek.mjs:265 — `req` IS the parsed request body
 *  (mock-deepseek.mjs:243 `record.body = parsed`), so tool results are read at req.messages[]. */
export function makeDecideM2({ promptMarker = PROMPT_MARKER } = {}) {
  let stage = 0
  return ({ req }) => {
    const messages = Array.isArray(req?.messages) ? req.messages : []
    const flat = JSON.stringify(messages)
    const resultFor = (id) => messages.some((m) => Array.isArray(m?.content)
      && m.content.some((c) => c?.type === 'tool_result' && c?.tool_use_id === id))
    if (stage === 0) {
      if (!flat.includes(promptMarker)) return { kind: 'text', content: 's1-m2-idle' } // e.g. the title request
      stage = 1
      return { kind: 'tool-call', toolCalls: [{ id: TC1, name: TOOL_NAME, arguments: { tag: 'call1' } }] }
    }
    if (stage === 1 && resultFor(TC1)) {
      stage = 2
      return { kind: 'tool-call', toolCalls: [{ id: TC2, name: TOOL_NAME, arguments: { tag: 'call2' } }] }
    }
    return { kind: 'text', content: 's1-m2-complete' }
  }
}

const strictResult = (block, tag) => {
  if (block?.type !== 'tool_result' || typeof block.content !== 'string') return false
  if (block.is_error === true) return false
  try {
    const v = JSON.parse(block.content)
    return v?.ran === true && v?.tag === tag && Array.isArray(v?.failed) && v.failed.length === 0
  } catch { return false }
}

export function resultRequestFor(mock, id, tag) {
  return mock.requests.find((r) => r.status === 200 && Array.isArray(r.body?.messages)
    && r.body.messages.some((m) => Array.isArray(m?.content) && m.content.some((c) => strictResult(c, tag) && c.tool_use_id === id)))
}

const nativeTerminal = (r) => r?.reply?.kind === 'text' && Array.isArray(r?.sent)
  && r.sent.some((x) => x?.type === 'message_stop')
  && r.sent.some((x) => x?.type === 'message_delta' && x?.delta?.stop_reason === 'end_turn')

function readLedger(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}

/**
 * M2 oracle.
 *  - PASS only when the whole sequence settled: swap performed, body #1 = B, control body #2 = A,
 *    all three legs ok for both, the call-#1 result request answered 200 AND the model actually
 *    issued call #2, and the final request (carrying the call-#2 result) got the text reply with
 *    native termination.
 *  - The call-#1 result reply is the SECOND tool call by design, so it must never be required to
 *    be text/message_stop (that would fake the protocol).
 *  - Fence and body legs are matched by the ACTUAL rootCallId of the corresponding dispatch, in
 *    ledger append order — not by tag alone and not by "two different ids exist".
 *  - Before settlement (and before the deadline / a real error) the run stays PENDING.
 */
export function evaluateM2Oracle({ ev, promptRes, sessionId, noTokenStatus, mock, final = false }) {
  const rows = readLedger(ev.ledger)
  const byLeg = (name) => rows.filter((r) => r.leg === name)
  const bodies = byLeg('body-ran')
  const enters = byLeg('fence-enter')
  const swaps = byLeg('fence-swapped')
  const restores = byLeg('fence-restored')
  const controls = byLeg('fence-control')
  const markers = existsSync(ev.markerDir) ? readdirSync(ev.markerDir).sort() : []
  const b1 = bodies[0]; const b2 = bodies[1]
  const legsOkFor = (callId, body) => callId !== undefined && ['marker-ran', 'read-ran', 'process-ran'].every((l) => {
    const set = rows.filter((r) => r.leg === l && r.callId === callId)
    return set.length === 1 && set[0].body === body && set[0].ok === true
  })
  const r1 = resultRequestFor(mock, TC1, 'call1')
  const r2 = resultRequestFor(mock, TC2, 'call2')
  const issuedSecondCall = r1 !== undefined && r1.status === 200
    && r1.reply?.kind === 'tool-call' && JSON.stringify(r1.reply?.toolCalls ?? '').includes(TC2)  // mock contract @8beade69: 'tool-call' (:133,:322,:360); record.reply is the decide output verbatim (:274)
  const finalTurn = r2 !== undefined && r2.status === 200 && nativeTerminal(r2)
  const settled = bodies.length === 2 && issuedSecondCall && finalTurn

  const checks = {
    token_gate_401: noTokenStatus === 401,
    session_created: typeof sessionId === 'string' && sessionId !== '',
    prompt_admitted_200: promptRes?.status === 200,
    register_a_once: byLeg('register').filter((r) => r.ok === true && r.body === 'A').length === 1,
    fence_entered_twice: enters.length === 2,
    distinct_call_ids: enters.length === 2 && enters[0].callId !== enters[1].callId,
    callid_correspondence: enters.length === 2 && b1 !== undefined && b2 !== undefined
      && enters[0].callId === b1.callId && enters[1].callId === b2.callId && b1.callId !== b2.callId,
    swap_leg_bound_to_call1_callid: swaps.length === 1 && b1 !== undefined && swaps[0].callId === b1.callId,
    restore_leg_bound_to_call1_callid: restores.length === 1 && b1 !== undefined && restores[0].callId === b1.callId,
    control_leg_bound_to_call2_callid: controls.length === 1 && b2 !== undefined && controls[0].callId === b2.callId,
    call1_ran_body_B: b1 !== undefined && b1.tag === 'call1' && b1.body === 'B',
    call1_body_ran_true: b1 !== undefined && b1.ran === true && Array.isArray(b1.failed) && b1.failed.length === 0,
    call2_ran_body_A_control: b2 !== undefined && b2.tag === 'call2' && b2.body === 'A',
    call2_body_ran_true: b2 !== undefined && b2.ran === true && Array.isArray(b2.failed) && b2.failed.length === 0,
    legs_all_ok_call1_by_callid: legsOkFor(b1?.callId, 'B'),
    legs_all_ok_call2_by_callid: legsOkFor(b2?.callId, 'A'),
    markers_exact_pair: markers.length === 2 && markers.includes('B-call1.marker') && markers.includes('A-call2.marker'),
    result_delivered_call1_and_second_call_issued: issuedSecondCall,
    result_delivered_call2_final_text: finalTurn,
    untriggered_name_zero: !rows.some((r) => JSON.stringify(r).includes(UNTRIGGERED_NAME)),
  }
  let outcome = 'pending'
  if (!final && !settled) outcome = 'pending'
  else if (bodies.length === 0) outcome = 'no-body'
  else if (b1?.body === 'A') outcome = 'early-binding-A'
  else if (!settled) outcome = issuedSecondCall ? 'not-delivered-call2-result' : 'not-delivered-call1-result'
  else if (checks.call1_ran_body_B && checks.call2_ran_body_A_control) outcome = 'late-resolution-B-then-control-A'
  else outcome = 'other'
  const pass = settled && Object.values(checks).every(Boolean)
  return {
    pass, settled, pending: !settled && !final, final, checks, outcome,
    counts: { bodies: bodies.length, markers: markers.length, mock_requests: mock.requests.length, distinct_call_ids: new Set(enters.map((r) => r.callId)).size },
    call_ids: { fence: enters.map((r) => r.callId), bodies: bodies.map((r) => r.callId) },
    markers,
    scope_note: 'PASS here proves late resolution of a same-name Definition inside the public tools/execute fence, plus the restored-A control. It is NOT a safety PASS and NOT an authorization bypass: no authorization check in this pipeline is bound to the Definition identity (tools/src/index.ts:1493-1519,:700-711 decide by name/arguments).',
  }
}

export async function runOnceM2({ port, worldName }) {
  const stamp = worldName.slice(WORLD_PREFIX.length)
  const world = validateInputs({ port, worldName })
  const ev = buildEvidencePlan({ stamp })
  const deadline = Date.now() + RUN_BUDGET_MS
  const runAbort = new AbortController()
  let timedOut = false
  let hardExitTimer
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
    hardExitTimer = setTimeout(() => {
      try { recordStep('hard-exit', 'fail', { reason: 'teardown did not settle within the bounded grace' }) } catch { /* best effort */ }
      process.exit(1)
    }, TEARDOWN_STEP_MS * 4).unref()
  }, RUN_BUDGET_MS)
  try {
    for (const c of preflight({ port, worldName })) {
      recordStep('preflight', c.ok ? 'ok' : 'fail', c)
      if (!c.ok) throw new Error(`preflight failed: ${c.check} — ${String(c.detail)}`)
    }
    mkdirSync(join(world, 'profiles', 'web'), { recursive: true })
    mkdirSync(join(world, 'sentinel'), { recursive: true })
    copyFileSync(join(HERE, 'probe-m2-plugin.mjs'), join(world, 'profiles', 'web', 's1m2-probe-plugin.mjs'))
    writeFileSync(join(world, 'sentinel', 's1m1-sentinel.txt'), buildSentinelContent(stamp))
    recordStep('world-skeleton', 'ok', { world })
    instance = new DshInstance({ hostTree: HTU, dshHome: world, port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: ev.runDir })
    instance.mountRows(PROBE_ROWS.map((row) => ({ ...row })), [...PATCH_HEADER_LINES])
    appendFileSync(instance.patchFile, EXT_CONTRIBUTOR_ROWS)
    const patchText = readFileSync(instance.patchFile, 'utf8')
    if (patchText !== buildPatchText()) throw new Error('patch layer mismatch vs buildPatchText()')
    recordStep('patch', 'ok', { sha256: createHash('sha256').update(patchText).digest('hex'), probe: './s1m2-probe-plugin.mjs', disabled_rows: ['session-log-deepseek', 'plugin-package-inventory-deepseek'], kept: ['deepseek-llm-api-extensions registry row', 'request.signal abort path', 'all tools', 'Guard', 'dispatch'] })
    mkdirSync(ev.markerDir, { recursive: true })
    recordStep('env-scrub', 'ok', { removed_keys: scrubProviderEnv() })
    process.env.DEEPSEEK_BASE_URL = 'http://127.0.0.1:__PORT__'
    process.env.DEEPSEEK_API_KEY = FAKE_KEY
    process.env.S1M2_LEDGER = ev.ledger
    process.env.S1M2_MARKER_DIR = ev.markerDir
    process.env.S1M2_SENTINEL = join(world, 'sentinel', 's1m1-sentinel.txt')
    process.env.S1M2_SENTINEL_EXPECT = buildSentinelContent(stamp).trim()
    mock = await startMockModel({ port: 0, decide: makeDecideM2(), log: (m) => recordStep('mock', 'info', m) })
    process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
    recordStep('mock-listen', 'ok', { port: mock.port })
    const startPromise = instance.start({ timeoutMs: Math.min(BOOT_TIMEOUT_MS, remaining()) }) // 1st and ONLY Host start
    hostChild = instance.child // owned handle captured BEFORE the first await (instance.mjs:87,:105,:117)
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
    const createRes = await apiSessionCreate(origin, cookie, world, 's1m2', runAbort.signal)
    recordStep('session-create', createRes.status === 200 ? 'ok' : 'fail', { status: createRes.status, body: createRes.body === null ? null : JSON.stringify(createRes.body).slice(0, 300) })
    if (createRes.status !== 200) throw new Error(`session/create returned ${String(createRes.status)}`)
    const sessionId = JSON.stringify(createRes.body).match(/"sessionId":"([^"]+)"/)?.[1]
    if (typeof sessionId !== 'string') throw new Error('sessionId absent from session/create response')
    sessionSnapshot = sessionId
    const promptRes = await apiPrompt(origin, cookie, sessionId, `s1m2 ${stamp} ${PROMPT_MARKER}`, 's1m2', runAbort.signal)
    recordStep('prompt', promptRes.status === 200 ? 'ok' : 'fail', { status: promptRes.status, body: promptRes.body === null ? null : JSON.stringify(promptRes.body).slice(0, 300) })
    promptResSnapshot = promptRes
    if (promptRes.status !== 200) throw new Error(`session/prompt returned ${String(promptRes.status)}`)
    const waitDeadline = Date.now() + Math.min(PROMPT_WAIT_MS, remaining())
    // A body row alone is an INTERMEDIATE state: stay pending until the sequence settles,
    // the wait deadline expires, or a real error aborts the run (caught below).
    for (;;) {
      const o = evaluateM2Oracle({ ev, promptRes, sessionId, noTokenStatus, mock, final: false })
      if (o.settled) { oracle = o; break }
      if (Date.now() >= waitDeadline || remaining() <= 0) { oracle = evaluateM2Oracle({ ev, promptRes, sessionId, noTokenStatus, mock, final: true }); break }
      await sleep(500, runAbort.signal)
    }
    recordStep('oracle', oracle.pass ? 'ok' : 'fail', { outcome: oracle.outcome, settled: oracle.settled, counts: oracle.counts, call_ids: oracle.call_ids })
    if (!oracle.pass) failed = true
  } catch (error) {
    failed = true
    runError = scrubSecrets(String(error?.message ?? error), token)
    recordStep('run', 'fail', { error: runError, stack: scrubSecrets(String(error?.stack ?? '').split('\n').slice(0, 4).join(' | '), token) })
    if (mock !== undefined) { try { oracle = evaluateM2Oracle({ ev, promptRes: promptResSnapshot, sessionId: sessionSnapshot, noTokenStatus: gateSnapshot, mock, final: true }) } catch { /* keep the earlier snapshot */ } }
  } finally {
    if (runAbort.signal.aborted) failed = true
    if (instance !== undefined) {
      try { const stopped = await instance.stop({ timeoutMs: Math.min(TEARDOWN_STEP_MS, Math.max(1, remaining())) }); recordStep('teardown-host', 'ok', stopped) } catch (e) { failed = true; recordStep('teardown-host', 'fail', { error: scrubSecrets(String(e?.message ?? e), token) }) }
      if (hostChild !== undefined && hostChild.exitCode === null && hostChild.signalCode === null) {
        failed = true
        try { hostChild.kill('SIGKILL') } catch (e) { recordStep('teardown-host-kill', 'fail', { error: scrubSecrets(String(e?.message ?? e), token) }) }
        const exited = await Promise.race([
          new Promise((res) => hostChild.once('close', () => res(true))),
          sleep(TEARDOWN_STEP_MS).then(() => false),
        ]).catch(() => false)
        const gone = hostChild.exitCode !== null || hostChild.signalCode !== null
        if (!exited || !gone) failed = true
        recordStep('teardown-host', 'fail', { reason: 'owned child alive after instance.stop(); SIGKILL requested', exited_within_bound: exited, handle_reaped: gone, exit_code: hostChild.exitCode, signal_code: hostChild.signalCode })
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
      // Raw instance log is KEPT; the redacted sibling is produced with the same scrubSecrets used everywhere.
      try {
        const raw = readFileSync(instance.logPath, 'utf8')
        writeFileSync(`${instance.logPath}.redacted`, scrubSecrets(raw, token), { mode: 0o600 })
        recordStep('redact-log', 'ok', { raw_kept: instance.logPath, redacted: `${instance.logPath}.redacted`, token_fingerprint: token === undefined ? 'absent' : createHash('sha256').update(token).digest('hex').slice(0, 8) })
      } catch (e) { recordStep('redact-log', 'fail', { error: String(e?.message ?? e) }) }
    }
    let free = false
    try { free = await Promise.race([waitForPortFree(port, TEARDOWN_STEP_MS), sleep(TEARDOWN_STEP_MS)]) } catch { free = false }
    if (!free) failed = true
    recordStep('port-recheck', free ? 'ok' : 'fail', { port, in_use: portInUse(port) })
    clearTimeout(watchdog)
    if (hardExitTimer !== undefined) clearTimeout(hardExitTimer)
    recordStep('world-kept', 'info', { world, note: 'kept; deletion forbidden' })
    const summary = { worldName, port, owned_pid: hostChild?.pid ?? null, run_error: runError ?? null, pass: oracle?.pass === true && !failed, outcome: oracle?.outcome ?? 'not-evaluated', oracle: oracle ?? null, failed, timed_out: timedOut, budget_ms: RUN_BUDGET_MS, used_ms: RUN_BUDGET_MS - remaining() }
    mkdirSync(ev.runDir, { recursive: true })
    writeFileSync(ev.summary, JSON.stringify(JSON.parse(scrubSecrets(JSON.stringify(summary), token)), null, 2) + '\n')
  }
  return { pass: oracle?.pass === true && !failed, ev, oracle }
}

async function main() {
  const argv = process.argv.slice(2)
  const go = argv.includes('--go')
  const pi = argv.indexOf('--port')
  const port = pi >= 0 ? Number(argv[pi + 1]) : 3180
  const wi = argv.indexOf('--world')
  const stamp = utcStamp()
  const worldName = wi >= 0 ? String(argv[wi + 1]) : `${WORLD_PREFIX}${stamp}`
  console.log(`# s1-h0-m2 launcher — mode=${go ? '--go (SINGLE REAL RUN: 1 Host start, 0 retries, 30-min watchdog)' : '--dry-run (default, read-only)'} port=${String(port)} world=${worldName}`)
  try { validateInputs({ port, worldName }); console.log('  [OK] input validation') } catch (e) { console.log(`  [FAIL] input validation — ${String(e?.message ?? e)}`); process.exit(1) }
  const checks = preflight({ port, worldName })
  for (const c of checks) console.log(`  [${c.ok ? 'OK' : 'FAIL'}] ${c.check}${c.detail !== undefined ? ` — ${String(c.detail).slice(0, 60)}` : ''}`)
  if (checks.some((c) => !c.ok)) { console.log('PREFLIGHT FAILED — fail-closed.'); process.exit(1) }
  const patch = buildPatchText()
  console.log(`\n## profiles/web/cordis.patch.yml (sha256 ${createHash('sha256').update(patch).digest('hex')}):\n${patch}`)
  console.log('## decide script: stage0 → tool-call {id:s1m2-tc-1,tag:call1} on the prompt-marked request; result(call1) → tool-call {id:s1m2-tc-2,tag:call2}; else text.')
  console.log('## expected markers on PASS: B-call1.marker (swap arm) + A-call2.marker (control arm)')
  console.log('## scope: PASS ⇒ late resolution only; not a safety PASS, not an authorization bypass.')
  if (!go) { console.log('\nDRY-RUN: nothing written, no Host started.'); return }
  const { pass } = await runOnceM2({ port, worldName })
  console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'} (evidence under ${buildEvidencePlan({ stamp: worldName.slice(WORLD_PREFIX.length) }).runDir})`)
  process.exit(pass ? 0 : 1)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`FATAL: ${scrubSecrets(String(e?.stack ?? e))}`); process.exit(2) })
}
