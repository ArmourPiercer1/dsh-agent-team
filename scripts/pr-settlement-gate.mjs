#!/usr/bin/env node
/**
 * pr-settlement-gate — machine enforcement of ROUTER_RULES §8.5 (R-DM-1,
 * settle-before-merge), landed as audit P1-1 (external audit intake #3) on
 * 2026-10-30. Before this script, §8.5 was law-without-a-gate: the marker
 * rule was enforced (badly) by a naive grep over title+body run by the merge
 * tooling, and the settlement rule (§8.5.2) was a human/agent convention only.
 *
 * WHAT THIS GATES, and what it deliberately does NOT gate:
 *   - OPEN-STATE MARKER (§8.5.1): raw ASCII `DO-NOT-MERGE` as a TITLE PREFIX or
 *     as the raw ASCII prefix of the FIRST BODY LINE ONLY. Marker present ⇒
 *     verdict BLOCKED-BY-MARKER (exit 1). While a PR is open for review that
 *     red is a STATEMENT, not a malfunction.
 *   - SETTLEMENT (§8.5.2): marker absent ⇒ require ≥1 issue comment whose
 *     FIRST LINE opens with the closed-set dated-settlement phrasing and whose
 *     body carries a 40-hex covered head sha EQUAL TO the head sha at check
 *     time. No such comment ⇒ FAIL (exit 1). A pushed commit moves the head
 *     sha, which mechanically retires any earlier settlement — that is §8.5.2's
 *     covered-sha requirement, not a policy invention of this script.
 *   - NOT HERE: the unresolved-review-thread check stays in the merge agent
 *     (§8.5.3's machine-refusing subject). This script does not duplicate it;
 *     ROUTER_RULES §8.5.6 records the split. No admin bypass, no branch
 *     protection changes — those were out of reach and out of scope.
 *
 * THE THREE #455 LESSONS, encoded as detection law (cite: PR #455 comments
 * 2026-10-29T16:00Z "dated tooling feedback" + 2026-10-29T16:00Z "dated
 * correction of the correction"):
 *   1. A DESCRIPTION that merely MENTIONS the token must not false-trip a
 *      grep of whole text — so matching is first-line/title-prefix only.
 *   2. Corner-bracketing 「DO-NOT-MERGE」 still contains the raw substring and
 *      still tripped the grep — substring containment is not a marker test.
 *   3. Fullwidth prose renderings (DO－NOT－MERGE, U+FF0D hyphens) are typeset
 *      prose, never markers — matching is on the exact ASCII bytes U+0044..
 *      U+0045 with U+002D hyphen-minus, case-sensitive.
 *
 * TEST SURFACE (disclosed choice, P1-1):
 *   - `--self-test`: fixture-driven verdict-algebra tests INSIDE this script,
 *     same code path as live mode, no network — the repo's ci-pr-gate.mjs
 *     convention. Wired into `.github/workflows/pr-gate.yml` (job
 *     `pr-settlement-gate`) so CI runs it on every PR.
 *   - `scripts/pr-settlement-gate.test.mjs` (node:test): external-consumer
 *     unit tests over the exported pure detectors plus one spawned `--input`
 *     end-to-end for exit codes — the `scripts/<name>.test.mjs` convention
 *     (precedent: eb3-tool-acceptance.test.mjs, sanitize-evidence.regression
 *     .test.mjs). Not collected by vitest root includes or the census.
 *   - `--input <file.json>`: offline dry-run over {title, body, head_sha,
 *     comments:[{body}]}, for dogfooding a live PR fetched with `gh api` and
 *     for humans reproducing any verdict without the workflow.
 *
 * EXIT: 0 PASS · 1 FAIL or BLOCKED-BY-MARKER · 2 ERROR (bad input, fetch
 * failure, head drift — a refusal, never a silent pass). Final line is always
 * a machine-readable `DSH-SETTLEMENT-VERDICT ...` token.
 */
import process from 'node:process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------- constants

/** The canonical open-state marker: raw ASCII, case-sensitive, U+002D hyphens.
 * Fullwidth variants are prose (§8.5.6, #455 lesson 3) and can never match
 * because their bytes differ — no transliteration happens anywhere here. */
export const MARKER_TOKEN = 'DO-NOT-MERGE'

/** Marker match: token at (trimmed) start, not followed by an alphanumeric —
 * `DO-NOT-MERGE — reason` is a marker; `DO-NOT-MERGED` is a different word. */
const MARKER_RE = /^DO-NOT-MERGE(?![0-9A-Za-z])/

/** Closed-set settlement openers, FIRST LINE ONLY (§8.5.6 machine reading of
 * §8.5.2's "dated" requirement). Precedent shape from PR #455's settlement:
 *   **[dated label settlement, 2026-10-29T15:4xZ — ... ]**
 * The `4x` shows why the time tail is unconstrained but the `YYYY-MM-DD`
 * date head is not: real settlements mask minutes, never dates. */
const SETTLEMENT_OPENER_RE =
  /^\s*\*{0,2}\[\s*dated(?:\s+label)?\s+settlement,\s*\d{4}-\d{2}-\d{2}[^\]]*\]\*{0,2}/i

/** Diagnostic-only loosening of the opener, used to tell a HUMAN WHY a comment
 * that looks like a settlement was not counted. It can never settle a PR. */
const LOOSE_SETTLEMENT_RE = /^\s*\*{0,2}\[?.*\bdated\b.*\bsettlement\b/i

/** Covered head sha: exactly 40 lowercase hex, as git prints them (§8.5.2). */
const SHA40_RE = /\b[0-9a-f]{40}\b/g
const SHA40_EXACT_RE = /^[0-9a-f]{40}$/

// ---------------------------------------------------------------- detectors

/** First raw line of a text, without normalizing anything inside it. */
export function firstLine(text) {
  if (typeof text !== 'string') return ''
  return text.split('\n', 1)[0].replace(/\r$/, '')
}

/**
 * §8.5.1 open-state marker detection. `title` is prefix-matched (after leading
 * whitespace trim); `body` is matched ONLY on its first raw line. Mentions
 * anywhere else are prose by law (#455 lessons 1–2), never markers.
 */
export function detectMarker({ title, body } = {}) {
  const onTitle = MARKER_RE.test((typeof title === 'string' ? title : '').trimStart())
  const onBodyFirstLine = MARKER_RE.test(firstLine(body).trimStart())
  return { present: onTitle || onBodyFirstLine, onTitle, onBodyFirstLine }
}

/**
 * §8.5.2 settlement detection over issue comments.
 * Returns { settled, headValid, candidates, matches, invalid }.
 *  - settled: ≥1 comment with strict opener on its FIRST LINE and a 40-hex
 *    sha equal to `headSha` (head sha as of CHECK TIME, supplied by caller).
 *  - candidates/invalid: diagnostics so a FAIL says what to fix; they never
 *    flip the verdict on their own.
 */
export function findSettlement(comments, headSha) {
  const headValid = typeof headSha === 'string' && SHA40_EXACT_RE.test(headSha)
  const out = { settled: false, headValid, candidates: 0, matches: [], invalid: [] }
  if (!Array.isArray(comments)) return out
  for (const [i, c] of comments.entries()) {
    const bodyText = typeof c?.body === 'string' ? c.body : ''
    if (!LOOSE_SETTLEMENT_RE.test(firstLine(bodyText))) continue
    out.candidates += 1
    const id = c?.id ?? `index:${i}`
    const openerOk = SETTLEMENT_OPENER_RE.test(firstLine(bodyText))
    const shas = bodyText.match(SHA40_RE) ?? []
    if (!openerOk) {
      out.invalid.push({ id, reason: 'NO_DATED_OPENER_FIRST_LINE' })
    } else if (shas.length === 0) {
      out.invalid.push({ id, reason: 'NO_40HEX_SHA' })
    } else if (!headValid || !shas.includes(headSha)) {
      out.invalid.push({ id, reason: 'SHA_NOT_CURRENT_HEAD' })
    } else {
      out.settled = true
      out.matches.push({ id, coveredSha: headSha })
    }
  }
  return out
}

/**
 * The whole verdict, as a pure function. Input: {title, body, comments,
 * headSha}. Output: {verdict, exit, marker, settlement, reasons, notes}.
 * verdicts: BLOCKED-BY-MARKER | PASS | FAIL | ERROR.
 */
export function evaluate({ title, body, comments, headSha } = {}) {
  const marker = detectMarker({ title, body })
  const settlement = findSettlement(comments, headSha)
  const reasons = []
  const notes = []

  if (!settlement.headValid) reasons.push('HEAD_SHA_INVALID')
  if (marker.present) {
    if (marker.onTitle) notes.push('marker=title-prefix')
    if (marker.onBodyFirstLine) notes.push('marker=body-first-line')
    if (settlement.settled) notes.push('settlement-observed-but-marker-present')
    return { verdict: 'BLOCKED-BY-MARKER', exit: 1, marker, settlement, reasons, notes }
  }
  if (reasons.includes('HEAD_SHA_INVALID')) {
    // Without a valid current head sha there is no covered-sha equality to
    // grade; refusing (exit 2) is honest where PASS or FAIL would both lie.
    return { verdict: 'ERROR', exit: 2, marker, settlement, reasons, notes }
  }
  if (settlement.settled) {
    return { verdict: 'PASS', exit: 0, marker, settlement, reasons, notes }
  }
  for (const inv of settlement.invalid) reasons.push(inv.reason)
  if (settlement.candidates === 0) reasons.push('NO_SETTLEMENT_CANDIDATE')
  if (reasons.length === 0) reasons.push('NO_VALID_SETTLEMENT')
  return { verdict: 'FAIL', exit: 1, marker, settlement, reasons, notes }
}

/** The one machine-readable line. Printed last, always. Fixed field order;
 * human notes stay in the rendered verdict / --json, never in the token. */
export function verdictToken(v) {
  const fields = [
    `DSH-SETTLEMENT-VERDICT ${v.verdict}`,
    `marker=${v.marker.present ? (v.marker.onBodyFirstLine ? 'body-first-line' : 'title-prefix') : 'none'}`,
    `matches=${v.settlement.matches.length}`,
    `candidates=${v.settlement.candidates}`,
  ]
  if (v.verdict === 'FAIL' || v.verdict === 'ERROR') fields.push(`reasons=${[...new Set(v.reasons)].join(',')}`)
  return fields.join(' ')
}

function renderVerdict(v, headSha) {
  const lines = []
  lines.push(`pr-settlement-gate: marker present = ${v.marker.present}` +
    (v.marker.present ? ` (title=${v.marker.onTitle}, body-first-line=${v.marker.onBodyFirstLine})` : ''))
  if (typeof headSha === 'string') lines.push(`head sha at check time: ${headSha}`)
  lines.push(`settlement: candidates=${v.settlement.candidates} valid=${v.settlement.matches.length} settled=${v.settlement.settled}`)
  for (const m of v.settlement.matches) lines.push(`  settles: comment ${m.id} covers ${m.coveredSha}`)
  for (const inv of v.settlement.invalid) lines.push(`  rejected: comment ${inv.id} → ${inv.reason}`)
  for (const n of v.notes) lines.push(`  note: ${n}`)
  if (v.reasons.length > 0) lines.push(`  reasons: ${[...new Set(v.reasons)].join(', ')}`)
  const explain = {
    'BLOCKED-BY-MARKER': 'open-state DO-NOT-MERGE marker present — merge is refused by §8.5.1; while a PR is open for review this red is a statement, not a malfunction. Remove the marker only together with a valid dated settlement (§8.5.4: deleting the marker text alone is not settlement).',
    PASS: 'valid dated settlement covering the current head sha (§8.5.2); unresolved-review threads remain the merge agent’s own gate (§8.5.3, not duplicated here).',
    FAIL: 'marker absent but no dated settlement comment covers the CURRENT head sha (§8.5.2). Post a first-line opener `[dated settlement, YYYY-MM-DDT...]` (or `dated label settlement`) including this exact 40-hex head sha. Corrections are NEW dated comments (§8.5.5) — never edit an old one.',
    ERROR: 'refused: the input itself is not gradeable (invalid head sha / bad payload). This is a refusal (exit 2), never a pass.',
  }[v.verdict]
  lines.push(`verdict: ${v.verdict} — ${explain}`)
  return lines.join('\n')
}

// ---------------------------------------------------------------- self-test

const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)
function settle(sha, opts = {}) {
  const kind = opts.label ? 'dated label settlement' : 'dated settlement'
  const head = opts.opener ?? `**[${kind}, 2026-10-30T12:0xZ — audit P1-1 dogfood]** Independent review APPROVE, seat qiyuan-self/qwen3.8-27b; head covered: ${sha}`
  return { id: opts.id ?? 1, body: opts.tailOnly ? head.replace(sha, '') : (opts.wrongLine ? `context line\n${head}` : head) }
}

/** Fixture-driven verdict-algebra tests. Same `evaluate` the CLI runs. */
export function selfTestCases() {
  const ok = (title, body, comments, head) => evaluate({ title, body, comments, headSha: head })
  return [
    // --- first-line matching law (#455 lessons) ---
    { name: 'title prefix marker blocks', run: () => ok('DO-NOT-MERGE — awaiting review', 'any description', [], SHA_A), want: 'BLOCKED-BY-MARKER' },
    { name: 'body first line marker blocks', run: () => ok('ci(scope): ready-ish', `DO-NOT-MERGE\n\nSettled per comment later.`, [], SHA_A), want: 'BLOCKED-BY-MARKER' },
    { name: 'marker with prose tail on body line 1', run: () => ok('t', 'DO-NOT-MERGE — pending R-455 follow-up\nbody', [], SHA_A), want: 'BLOCKED-BY-MARKER' },
    { name: 'body-line-1 marker tolerates leading spaces', run: () => ok('t', '  DO-NOT-MERGE\nbody', [], SHA_A), want: 'BLOCKED-BY-MARKER' },
    { name: 'LESSON 1: description mention is prose, not marker', run: () => ok('docs(protocol): codify settle-before-merge', 'This rule forbids merging when DO-NOT-MERGE appears on the first line.', [], SHA_A), want: 'FAIL' },
    { name: 'LESSON 1: title mention (non-prefix) is prose', run: () => ok('[REVIEWED APPROVE] notes DO-NOT-MERGE handling', 'body', [], SHA_A), want: 'FAIL' },
    { name: 'LESSON 2: corner-bracketed mention is prose', run: () => ok('t', 'prose 「DO-NOT-MERGE」 mention mid-body', [], SHA_A), want: 'FAIL' },
    { name: 'LESSON 3: fullwidth variant is prose, never marker', run: () => ok('DO－NOT－MERGE fullwidth', `DO－NOT－MERGE\nsecond line`, [], SHA_A), want: 'FAIL' },
    { name: 'lowercase is not the canonical token (case law)', run: () => ok('t', 'do-not-merge\nbody', [], SHA_A), want: 'FAIL' },
    { name: 'DO-NOT-MERGED is a different word', run: () => ok('DO-NOT-MERGED already', 'body', [], SHA_A), want: 'FAIL' },
    { name: 'CRLF body, token on line 1', run: () => ok('t', 'DO-NOT-MERGE\r\nbody', [], SHA_A), want: 'BLOCKED-BY-MARKER' },
    { name: 'marker present + settlement present → still blocked (§8.5.1)', run: () => ok('t', `DO-NOT-MERGE\nbody`, [settle(SHA_A)], SHA_A), want: 'BLOCKED-BY-MARKER' },
    // --- settlement algebra (§8.5.2 covered sha) ---
    { name: 'valid dated settlement covering head passes', run: () => ok('t', 'Settled per comment.', [settle(SHA_A)], SHA_A), want: 'PASS' },
    { name: 'valid dated LABEL settlement passes', run: () => ok('t', 'body', [settle(SHA_A, { label: true })], SHA_A), want: 'PASS' },
    { name: 'settlement covering OLD sha fails', run: () => ok('t', 'body', [settle(SHA_B)], SHA_A), want: 'FAIL' },
    { name: 'settlement without any sha fails', run: () => ok('t', 'body', [settle(SHA_A, { tailOnly: true })], SHA_A), want: 'FAIL' },
    { name: 'settlement opener NOT on first line fails', run: () => ok('t', 'body', [settle(SHA_A, { wrongLine: true })], SHA_A), want: 'FAIL' },
    { name: 'non-closed-set opener fails (settlement-linkage is not a record)', run: () => ok('t', 'body', [{ id: 1, body: `**[dated settlement-linkage, 2026-10-29T16:2xZ]** head ${SHA_A}` }], SHA_A), want: 'FAIL' },
    { name: 'no comments at all fails', run: () => ok('t', 'body', [], SHA_A), want: 'FAIL' },
    { name: 'multiple comments; second settles', run: () => ok('t', 'body', [settle(SHA_B), settle(SHA_A)], SHA_A), want: 'PASS' },
    { name: 'short sha never settles', run: () => ok('t', 'body', [{ id: 1, body: `**[dated settlement, 2026-10-30T12:0xZ]** head ${SHA_A.slice(0, 9)}` }], SHA_A), want: 'FAIL' },
    { name: 'invalid head sha refuses (ERROR, never a laundered PASS)', run: () => ok('t', 'body', [settle(SHA_A)], 'nope'), want: 'ERROR' },
    { name: 'missing head sha refuses (ERROR)', run: () => evaluate({ title: 't', body: 'b', comments: [] }), want: 'ERROR' },
  ]
}

function runSelfTest() {
  let pass = 0
  let fail = 0
  for (const t of selfTestCases()) {
    let got
    try {
      got = t.run().verdict
    } catch (e) {
      got = `THREW:${e?.message}`
    }
    if (got === t.want) {
      pass += 1
      process.stdout.write(`ok — ${t.name}\n`)
    } else {
      fail += 1
      process.stdout.write(`NOT OK — ${t.name}: want ${t.want}, got ${got}\n`)
    }
  }
  process.stdout.write(`pr-settlement-gate --self-test: pass=${pass} fail=${fail}\n`)
  process.stdout.write(`DSH-SETTLEMENT-VERDICT ${fail === 0 ? 'PASS' : 'FAIL'} mode=self-test pass=${pass} fail=${fail}\n`)
  return fail === 0 ? 0 : 1
}

// ------------------------------------------------------------------ live IO

async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`FETCH_FAILED ${res.status} ${url}`)
  return res.json()
}

async function fetchPrAndComments({ repo, pr, apiBase, token }) {
  const base = apiBase.replace(/\/+$/, '')
  const prj = await fetchJson(`${base}/repos/${repo}/pulls/${pr}`, token)
  const comments = []
  for (let page = 1; page <= 20; page += 1) {
    const chunk = await fetchJson(`${base}/repos/${repo}/issues/${pr}/comments?per_page=100&page=${page}`, token)
    comments.push(...chunk)
    if (chunk.length < 100) break
  }
  return { title: prj.title, body: prj.body, headSha: prj?.head?.sha, comments }
}

function parseArgs(argv) {
  const opts = { mode: 'help', pr: null, repo: process.env.GITHUB_REPOSITORY ?? null, expectedHead: null, apiBase: process.env.GITHUB_API_URL || 'https://api.github.com', input: null, json: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const next = () => { i += 1; const v = argv[i]; if (v === undefined) throw new Error(`missing value for ${a}`); return v }
    if (a === '--self-test') opts.mode = 'self-test'
    else if (a === '--input') { opts.mode = 'input'; opts.input = next() }
    else if (a === '--pr') { opts.mode = 'live'; opts.pr = Number(next()) }
    else if (a === '--repo') opts.repo = next()
    else if (a === '--expected-head') opts.expectedHead = next()
    else if (a === '--api-base') opts.apiBase = next()
    else if (a === '--json') opts.json = true
    else if (a === '--help' || a === '-h') opts.mode = 'help'
    else throw new Error(`unknown argument ${a}`)
  }
  return opts
}

const USAGE = `pr-settlement-gate — ROUTER_RULES §8.5.6 machine gate (marker + dated settlement + covered head sha)
usage:
  node scripts/pr-settlement-gate.mjs --self-test
  node scripts/pr-settlement-gate.mjs --input <file.json>        # {title,body,head_sha,comments:[{body}]}
  node scripts/pr-settlement-gate.mjs --pr <n> [--repo o/r] [--expected-head <sha>]
                                                # live via GITHUB_TOKEN/GH_TOKEN; default repo=$GITHUB_REPOSITORY
exit: 0 PASS · 1 FAIL or BLOCKED-BY-MARKER · 2 ERROR (refusal, never a silent pass)
`

async function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (e) {
    process.stdout.write(`${e.message}\n${USAGE}`)
    return 2
  }
  if (opts.mode === 'help') { process.stdout.write(USAGE); return 2 }
  if (opts.mode === 'self-test') return runSelfTest()

  let payload
  if (opts.mode === 'input') {
    const raw = JSON.parse(readFileSync(opts.input, 'utf8'))
    payload = { title: raw.title, body: raw.body, headSha: raw.head_sha ?? raw.headSha, comments: raw.comments ?? [] }
  } else {
    if (!Number.isInteger(opts.pr) || opts.pr <= 0) { process.stdout.write(`--pr needs a positive number\n${USAGE}`); return 2 }
    if (!opts.repo) { process.stdout.write('no repo: pass --repo owner/name or set GITHUB_REPOSITORY\n'); return 2 }
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null
    if (!token) { process.stdout.write('ERROR NO_TOKEN: set GITHUB_TOKEN or GH_TOKEN for live mode\nDSH-SETTLEMENT-VERDICT ERROR reasons=NO_TOKEN\n'); return 2 }
    try {
      payload = await fetchPrAndComments({ repo: opts.repo, pr: opts.pr, apiBase: opts.apiBase, token })
    } catch (e) {
      process.stdout.write(`${e.message}\nDSH-SETTLEMENT-VERDICT ERROR reasons=FETCH_FAILED\n`)
      return 2
    }
    if (opts.expectedHead && opts.expectedHead !== payload.headSha) {
      process.stdout.write(`HEAD_DRIFT: event says head ${opts.expectedHead}, API says ${payload.headSha} — refusing to grade a moving target\nDSH-SETTLEMENT-VERDICT ERROR reasons=HEAD_DRIFT\n`)
      return 2
    }
  }

  const v = evaluate(payload)
  if (opts.json) process.stdout.write(`${JSON.stringify({ ...v, headSha: payload.headSha }, null, 2)}\n`)
  process.stdout.write(`${renderVerdict(v, payload.headSha)}\n`)
  process.stdout.write(`${verdictToken(v)}\n`)
  return v.exit
}

// Import-safety guard (precedent: eb3-tool-acceptance.mjs:465) — the unit
// test file imports the pure detectors, and an unguarded main() would
// process.exit() underneath the test runner.
const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  main().then((code) => process.exit(code), (e) => {
    process.stdout.write(`ERROR UNEXPECTED ${e?.stack ?? e}\nDSH-SETTLEMENT-VERDICT ERROR reasons=UNEXPECTED\n`)
    process.exit(2)
  })
}