#!/usr/bin/env node
/**
 * a5sf-diag.mjs — R4 / BL-12: approval-bypass + failure-classification report for
 * an Alpha.5 Sandbox-First run/evidence directory (or one JSONL call log).
 *
 * WHAT IT IS. A READ-ONLY reader of a run's diagnostic rows that answers exactly two
 * questions, and refuses to answer either one when the rows cannot decide it:
 *
 *   1. "Was there an approval bypass?" — for every call the log says was decided
 *      `allow`, re-decide the SAME authored locator against the compiled ceiling the
 *      log carries, and require the durable approval row whenever that ceiling says
 *      `ask`. Reported as `APPROVAL_BYPASS file:line code=… callId=…`.
 *   2. "What class is this failure?" — every refusal line / shadow row / bare code is
 *      handed to the EXISTING PR #394 classifier and its class string is printed
 *      verbatim (`FAILURE_CLASS … code=… attribution=…`). A Sandbox-First code the
 *      table cannot express is `FAILURE_CLASS_GAP …` — disclosed, never added to the
 *      table (a second vocabulary is the hazard the reclamation registry forbids).
 *
 * SINGLE SOURCES (imported, never copied — this file contains no classification row
 * and no locator-matching rule of its own):
 *   - failure classification: `scripts/diag-call-chain.mjs` (PR #394, EB4-B) —
 *     `FACE_TABLE`, `attribute()` and `diagnose()`. The class strings and face
 *     attribution printed here are that module's output.
 *   - locator semantics: `packages/runtime/member-io-policy/src/path-rules.ts`
 *     `matchLocator()` (P1-02/P1-03) — the ONE subtree-aware allow/ask/deny algebra.
 *     SEAM NOTE (disclosed, not patched): `matchLocator` is not re-exported by the
 *     `member-io-policy` barrel at this tree, so this script deep-imports the module
 *     through the repo's EXISTING TS hook (`scripts/run-tests-hooks.mjs`), exactly as
 *     `tests/world-factory/lib/a5sf-harness.mjs` does. No new loader, no TS change.
 *
 * WHAT A LOG MUST CONTAIN (declared input contract; there is NO producer of these
 * rows in a real a5sf run yet — P2 wires the execution lane, see LIMITS):
 *
 *   {"kind":"ceiling","member":"alpha","tools":[
 *      {"tool":"read","binding":"native.read",
 *       "read":{mode,allow,ask,deny},"write":{mode,allow,ask,deny},
 *       "network":{"access":"allow"|"deny"}}]}
 *       — the compiled per-tool ceiling the lane decided against. `read`/`write` are
 *         the P1 `PathRuleSet` shape verbatim.
 *
 *   {"kind":"call","callId":"c1","member":"alpha","tool":"read","axis":"read",
 *    "locator":"/work/alpha/f","lane":"allow"|"ask"|"deny",
 *    "approvalRequestId":"req-1"?}
 *       — one decided call. `axis` is read|write (network is a boolean this round).
 *
 *   {"kind":"approval","requestId":"req-1","decisionSequence":7,
 *    "consumedAt":"<ISO-8601>","scope":{rootSessionId,targetInstanceId,toolName,
 *    correlation,operationFingerprint?}}
 *       — the durable `control-allow-consumed` fact (the real ControlConsumptionRecord
 *         shape). Presence of this row IS the consumption; this tool never mints one.
 *
 *   {"kind":"failure","callId":"c1","text":"a5p5-refused kind=… code=… detail=…"}
 *   {"kind":"compiler-refusal","callId":"c2","code":"MEMBER_GENERATION_STALE"}
 *       — a refusal line/row for the PR #394 classifier, or a P1 compiler refusal code.
 *
 * Usage:
 *   node scripts/a5sf-diag.mjs <dir-or-file> [--json]
 * Exit: 0 no finding and no gap · 1 finding / disclosed gap / undecidable call ·
 *       2 REFUSED (usage, missing input, invalid JSON, no call rows, locator algebra unavailable).
 *
 * CORE PATCH BUDGET = 0: reads tracked repo sources and the input path only; no Host
 * boot, no port, no DSH_HOME, no network, no writes.
 *
 * @module scripts/a5sf-diag
 */
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { register } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { attribute, diagnose } from './diag-call-chain.mjs'
import { redactAll } from './redaction-patterns.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const TOOL = 'scripts/a5sf-diag.mjs'

/** Declared + enforced bounds. */
export const BOUNDS = Object.freeze({ inputBytes: 8 * 1024 * 1024, rows: 50_000, fieldCap: 160 })

export const LIMITS = Object.freeze([
  'READ-ONLY over the rows it is handed: no Host boot, no live ledger read beyond the input, no re-run, no write',
  'not an authority: printing ALLOW_LEGITIMATE never grants, approves or extends anything; only the durable ControlService row does that',
  'the input row schema is declared by this tool, not yet emitted by a production a5sf lane (P2): an absent ceiling/approval row is UNDECIDABLE, never "clean"',
  'a call whose axis is network is UNDECIDABLE here: network is a boolean this round and destination granularity is unsupported',
  'an a5sf compiler refusal code has NO PR #394 row: the gap is printed, never filled by adding a row to that table',
  'redaction reuses scripts/redaction-patterns.mjs; it cannot prove the absence of a secret the pattern list does not know',
])

/**
 * The P1 locator algebra, imported through the repo's existing TS hook. A failure
 * here is fail-closed (every allow call becomes UNDECIDABLE), never a fallback to a
 * locally invented matcher.
 */
async function loadLocatorAlgebra(repoRoot) {
  try {
    register(pathToFileURL(join(repoRoot, 'scripts', 'run-tests-hooks.mjs')).href)
    return await import(pathToFileURL(join(repoRoot, 'packages', 'runtime', 'member-io-policy', 'src', 'path-rules.ts')).href)
  } catch (e) {
    return { loadError: String(e?.message ?? e) }
  }
}

export const LOCATOR_ALGEBRA = await loadLocatorAlgebra(REPO_ROOT)

/** Redact + flatten + cap one free-text value (the PR #394 redaction vocabulary). */
export function safeField(value) {
  if (value === undefined || value === null) return null
  const { text } = redactAll(String(value))
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > BOUNDS.fieldCap ? `${flat.slice(0, BOUNDS.fieldCap)}…(+${String(flat.length - BOUNDS.fieldCap)} cut)` : flat
}

const displayPath = (abs) => {
  const rel = relative(process.cwd(), abs)
  return rel === '' || rel.startsWith('..') ? abs : rel
}

const isNonBlank = (v) => typeof v === 'string' && v.trim() !== ''

/** Validate the tool-entry lanes the tool is willing to decide. */
function validLane(value) {
  return value !== null && typeof value === 'object' && (value.mode === 'all' || value.mode === 'restricted') &&
    Array.isArray(value.allow) && Array.isArray(value.ask) && Array.isArray(value.deny)
}

/**
 * Read one JSONL file or a flat directory of `*.jsonl` files into
 * `{ rows: [{ row, file, line }], files }`. Any unreadable/oversize/invalid input is
 * a refusal, never an empty report. Row order = file order, then line order.
 */
export function collectInput(target) {
  const abs = resolve(target)
  if (!existsSync(abs)) return { error: `NO_SUCH_PATH ${target}` }
  const st = lstatSync(abs)
  if (st.isSymbolicLink()) return { error: `SYMLINK_REFUSED ${target}` }
  let files
  if (st.isDirectory()) {
    files = readdirSync(abs).filter((name) => name.endsWith('.jsonl')).sort().map((name) => join(abs, name))
    if (files.length === 0) return { error: `NO_JSONL_FILES ${target}` }
  } else if (st.isFile()) {
    files = [abs]
  } else {
    return { error: `NOT_A_FILE_OR_DIR ${target}` }
  }
  const rows = []
  let totalBytes = 0
  for (const file of files) {
    const fst = lstatSync(file)
    if (!fst.isFile() || fst.isSymbolicLink()) return { error: `NOT_A_REGULAR_FILE ${displayPath(file)}` }
    totalBytes += fst.size
    if (fst.size > BOUNDS.inputBytes || totalBytes > BOUNDS.inputBytes) {
      return { error: `INPUT_OVER_BOUND ${displayPath(file)} (${String(totalBytes)} > ${String(BOUNDS.inputBytes)} bytes)` }
    }
    const text = readFileSync(file, 'utf8')
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (line.trim() === '') continue
      let row
      try { row = JSON.parse(line) } catch { return { error: `INVALID_JSON ${displayPath(file)}:${String(index + 1)}` } }
      rows.push({ row, file: displayPath(file), line: index + 1 })
      if (rows.length > BOUNDS.rows) return { error: `TOO_MANY_ROWS (> ${String(BOUNDS.rows)})` }
    }
  }
  return { rows, files: files.map(displayPath), bytes: totalBytes }
}

/** A durable approval authorizes a call only for the SAME identity it was minted for. */
export function approvalAuthorizes(approval, call) {
  if (approval === null || typeof approval !== 'object') return false
  if (!isNonBlank(approval.consumedAt) || !Number.isInteger(approval.decisionSequence)) return false
  const scope = approval.scope
  if (scope === null || typeof scope !== 'object') return false
  return isNonBlank(scope.rootSessionId) &&
    scope.targetInstanceId === call.member &&
    scope.toolName === call.tool &&
    scope.correlation === call.callId
}

/** Stable, order-preserving analysis of already-parsed rows. */
export function analyzeRows(rows) {
  const ceilings = new Map()
  const approvals = []
  const calls = []
  const failures = []
  const compilerRefusals = []
  const invalid = []
  let ignored = 0

  for (const entry of rows) {
    const { row } = entry
    const kind = row?.kind
    if (kind === 'ceiling') {
      if (!isNonBlank(row.member) || !Array.isArray(row.tools)) { invalid.push({ ...entry, reason: 'ceiling needs member + tools[]' }); continue }
      ceilings.set(row.member, row)
    } else if (kind === 'approval') {
      if (!isNonBlank(row.requestId) || row.scope === null || typeof row.scope !== 'object') { invalid.push({ ...entry, reason: 'approval needs requestId + scope' }); continue }
      approvals.push(row)
    } else if (kind === 'call') {
      if (!isNonBlank(row.callId) || !isNonBlank(row.member) || !isNonBlank(row.tool) || !isNonBlank(row.locator) || !['allow', 'ask', 'deny'].includes(row.lane)) {
        invalid.push({ ...entry, reason: 'call needs callId/member/tool/locator/lane' }); continue
      }
      calls.push(row)
    } else if (kind === 'failure') {
      if (!isNonBlank(row.text)) { invalid.push({ ...entry, reason: 'failure needs text' }); continue }
      failures.push(row)
    } else if (kind === 'compiler-refusal') {
      if (!isNonBlank(row.code)) { invalid.push({ ...entry, reason: 'compiler-refusal needs code' }); continue }
      compilerRefusals.push(row)
    } else {
      ignored += 1
    }
  }

  const findings = []
  const legitimate = []
  const undecidable = []
  const validCalls = new Set(calls)
  const validFailures = new Set(failures)
  const validCompilerRefusals = new Set(compilerRefusals)
  let allowCalls = 0

  const addFinding = (entry, code, extra) => findings.push({ file: entry.file, line: entry.line, code, ...extra })
  const addUndecidable = (entry, code, extra) => undecidable.push({ file: entry.file, line: entry.line, code, ...extra })

  for (const entry of rows) {
    const call = entry.row
    if (call?.kind !== 'call' || !validCalls.has(call)) continue
    if (call.lane !== 'allow') continue
    allowCalls += 1
    const common = { callId: call.callId, member: call.member, tool: call.tool, axis: call.axis, locator: call.locator }
    if (call.axis !== 'read' && call.axis !== 'write') {
      addUndecidable(entry, 'AXIS_UNSUPPORTED', { callId: call.callId, axis: call.axis, why: 'only read|write are decidable; network is a boolean this round' })
      continue
    }
    const ceiling = ceilings.get(call.member)
    if (ceiling === undefined) {
      addUndecidable(entry, 'NO_COMPILED_CEILING', { callId: call.callId, member: call.member })
      continue
    }
    const toolEntry = ceiling.tools.find((t) => t !== null && typeof t === 'object' && t.tool === call.tool)
    if (toolEntry === undefined) {
      addFinding(entry, 'TOOL_NOT_IN_COMPILED_CEILING', { ...common, compiled: 'absent' })
      continue
    }
    const lane = toolEntry[call.axis]
    if (!validLane(lane)) {
      addUndecidable(entry, 'CEILING_AXIS_MISSING', { callId: call.callId, tool: call.tool, axis: call.axis })
      continue
    }
    if (typeof LOCATOR_ALGEBRA.matchLocator !== 'function') {
      addUndecidable(entry, 'LOCATOR_ALGEBRA_UNAVAILABLE', { callId: call.callId, why: safeField(LOCATOR_ALGEBRA.loadError) })
      continue
    }
    const disposition = LOCATOR_ALGEBRA.matchLocator(lane, call.locator)
    if (disposition === 'deny') {
      addFinding(entry, 'ALLOW_OUTSIDE_COMPILED_CEILING', { ...common, compiled: 'deny' })
      continue
    }
    if (disposition === 'allow') continue
    // disposition === 'ask': the ceiling requires the durable approval authority.
    const named = isNonBlank(call.approvalRequestId)
      ? approvals.find((a) => a.requestId === call.approvalRequestId)
      : approvals.find((a) => approvalAuthorizes(a, call))
    if (named === undefined) {
      addFinding(entry, 'ALLOW_WITHOUT_DURABLE_APPROVAL', { ...common, compiled: 'ask', requestId: call.approvalRequestId })
      continue
    }
    if (!approvalAuthorizes(named, call)) {
      addFinding(entry, 'APPROVAL_SCOPE_MISMATCH', { ...common, compiled: 'ask', requestId: named.requestId })
      continue
    }
    legitimate.push({ file: entry.file, line: entry.line, code: 'APPROVAL_CONSUMED_NARROWED_ALLOW', callId: call.callId, requestId: named.requestId, tool: call.tool, axis: call.axis })
  }

  // Failure classification: delegate, print the class string verbatim, disclose a gap.
  const classified = []
  const gaps = []
  for (const entry of rows) {
    const row = entry.row
    if (row?.kind === 'failure' && validFailures.has(row)) {
      const r = diagnose(row.text, { json: true })
      if (r.exit === 2) {
        gaps.push({ file: entry.file, line: entry.line, code: 'NO_REFUSAL_PARSED', source: 'a5p5-input', reason: 'the PR #394 classifier refused the text; nothing is classified' })
        continue
      }
      let report
      try { report = JSON.parse(r.stdout) } catch {
        gaps.push({ file: entry.file, line: entry.line, code: 'CLASSIFIER_UNREADABLE', source: 'a5p5-input', reason: 'classifier output did not parse' })
        continue
      }
      for (const refusal of report.refusals ?? []) {
        if (['UNKNOWN_CODE', 'UNKNOWN_KIND', 'NO_PRODUCTION_EMITTER'].includes(refusal.verdict)) {
          gaps.push({ file: entry.file, line: entry.line, code: refusal.code, source: 'a5p5-input', reason: `PR #394 table verdict ${refusal.verdict}; vocabulary NOT extended` })
          continue
        }
        classified.push({
          file: entry.file, line: entry.line, code: refusal.code, attribution: refusal.verdict,
          faces: (refusal.candidates ?? []).map((c) => c.face).join('+') || '-',
        })
      }
    } else if (row?.kind === 'compiler-refusal' && validCompilerRefusals.has(row)) {
      const known = attribute(null, row.code)
      const overlapping = known.verdict !== 'UNKNOWN_CODE' && known.verdict !== 'NO_PRODUCTION_EMITTER'
      gaps.push({
        file: entry.file, line: entry.line, code: row.code, source: 'a5sf-compiler',
        overlappingAlpha5String: overlapping,
        reason: 'the PR #394 table has no a5sf compiler row; quoting an overlapping Alpha.5 string would be a cross-vocabulary misattribution',
      })
    }
  }

  return { findings, legitimate, undecidable, invalid, ignored, classified, gaps, calls: calls.length, allowCalls }
}

/** Render the machine-readable report (one token-grammar line per finding/class). */
export function renderReport(result) {
  const out = []
  out.push(`A5SF-DIAG tool=${TOOL} rows=${String(result.rows)} files=${String(result.files)}`)
  out.push(`SOURCE classification=scripts/diag-call-chain.mjs#FACE_TABLE,attribute,diagnose locators=packages/runtime/member-io-policy/src/path-rules.ts#matchLocator`)
  for (const f of result.findings) {
    out.push(`APPROVAL_BYPASS file=${f.file}:${String(f.line)} code=${f.code} callId=${safeField(f.callId)} member=${safeField(f.member)} tool=${safeField(f.tool)} axis=${safeField(f.axis)} lane=allow compiled=${f.compiled} locator=${safeField(f.locator)}${f.requestId === undefined ? '' : ` requestId=${safeField(f.requestId)}`}`)
  }
  for (const l of result.legitimate) {
    out.push(`ALLOW_LEGITIMATE file=${l.file}:${String(l.line)} code=${l.code} callId=${safeField(l.callId)} requestId=${safeField(l.requestId)} tool=${safeField(l.tool)} axis=${safeField(l.axis)}`)
  }
  for (const u of result.undecidable) {
    out.push(`UNDECIDABLE file=${u.file}:${String(u.line)} code=${u.code} callId=${u.callId === undefined ? '-' : safeField(u.callId)}${u.member === undefined ? '' : ` member=${safeField(u.member)}`}${u.axis === undefined ? '' : ` axis=${safeField(u.axis)}`}${u.why === undefined ? '' : ` why=${safeField(u.why)}`}`)
  }
  for (const i of result.invalid) {
    out.push(`ROW_INVALID file=${i.file}:${String(i.line)} reason=${safeField(i.reason)}`)
  }
  for (const c of result.classified) {
    out.push(`FAILURE_CLASS file=${c.file}:${String(c.line)} code=${safeField(c.code)} attribution=${c.attribution} faces=${c.faces}`)
  }
  for (const g of result.gaps) {
    out.push(`FAILURE_CLASS_GAP file=${g.file}:${String(g.line)} code=${safeField(g.code)} source=${g.source}${g.overlappingAlpha5String === undefined ? '' : ` overlappingAlpha5String=${String(g.overlappingAlpha5String)}`} reason=${safeField(g.reason)}`)
  }
  const verdict = result.findings.length > 0 ? 'BYPASS_FOUND'
    : result.undecidable.length > 0 || result.invalid.length > 0 ? 'INCOMPLETE'
      : result.gaps.length > 0 ? 'GAP_DISCLOSED'
        : 'NO_BYPASS_FOUND'
  out.push(`SUMMARY calls=${String(result.calls)} allow=${String(result.allowCalls)} findings=${String(result.findings.length)} legitimate_narrowed=${String(result.legitimate.length)} undecidable=${String(result.undecidable.length + result.invalid.length)} classified=${String(result.classified.length)} gaps=${String(result.gaps.length)} verdict=${verdict}`)
  for (const limit of LIMITS) out.push(`LIMIT ${limit}`)
  return `${out.join('\n')}\n`
}

/** The whole run as a pure-ish function of (path): { exit, stdout }. */
export function analyze(target) {
  const collected = collectInput(target)
  if (collected.error !== undefined) return { exit: 2, stdout: `REFUSED ${collected.error}: an unreadable or empty input is not "nothing wrong"\n` }
  const result = analyzeRows(collected.rows)
  if (result.calls === 0 && result.classified.length === 0 && result.gaps.length === 0 && result.invalid.length === 0) {
    return { exit: 2, stdout: 'REFUSED NO_CALL_ROWS: the input holds no `kind=call` row and no failure/compiler-refusal row, so neither question can be answered\n' }
  }
  result.rows = collected.rows.length
  result.files = collected.files.length
  const stdout = renderReport(result)
  const bad = result.findings.length > 0 || result.gaps.length > 0 || result.undecidable.length > 0 || result.invalid.length > 0
  return { exit: bad ? 1 : 0, stdout }
}

function usage(message) {
  process.stdout.write(`REFUSED USAGE${message ? `: ${message}` : ''}\nusage: node ${TOOL} <evidence-dir-or-jsonl> [--json]\n`)
  return 2
}

function runCli(argv) {
  let target = null
  let json = false
  for (const arg of argv) {
    if (arg === '--json') json = true
    else if (arg === '--help' || arg === '-h') { process.stdout.write(`usage: node ${TOOL} <evidence-dir-or-jsonl> [--json]\n`); return 0 }
    else if (arg.startsWith('--')) return usage(`unknown option ${JSON.stringify(arg.slice(0, 40))}`)
    else if (target === null) target = arg
    else return usage('exactly one input path')
  }
  if (target === null) return usage('one input path is required')
  const { exit, stdout } = analyze(target)
  if (json) {
    const lines = stdout.trimEnd().split('\n').map((text) => ({ text }))
    process.stdout.write(`${JSON.stringify({ tool: TOOL, exit, lines })}\n`)
  } else {
    process.stdout.write(stdout)
  }
  return exit
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) process.exitCode = runCli(process.argv.slice(2))
