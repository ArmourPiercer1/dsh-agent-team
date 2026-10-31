#!/usr/bin/env node
/**
 * Alpha.6 PR-I1a (Lane 2) — the REAL-HOST instrument for the durability legs PR #517 recorded as C2 = ENV_BLOCK.
 *
 * WHAT THIS PAYS. PR #517's body §4 (D-10) and §8 line 223 both state that no Host process was ever booted for
 * this PR, so nothing in it may be read as a Host-level pass, and the restart legs were C1 at best because the
 * in-memory fake's close/open is a repository rebuild and not a disk. That was true at `256410456` and every
 * earlier head of this branch, and it was recorded as a refusal rather than dressed up as a green. A real
 * runtime is now materialized in THIS worktree (`tests/deepseek-harness-test-use`, pristine, detached at
 * `TEST_USE_BASELINE_SHA`), so the claim is re-graded by measurement instead of by re-reading the memo.
 *
 * WHAT A BOOT HERE CAN AND CANNOT REACH. PR-I1a ships a DORMANT writer: `ALLOWED_CONSUMERS` is empty and the
 * dormancy walk in `a6-pr2-lane-hygiene.test.ts` proves no production module imports it. So no product seam
 * reaches `applyReviewAssignment` on a live host — that is the design, and PR-I1b is the first PR with a caller.
 * Two consequences, both disclosed rather than papered over:
 *   - these boots mount a PROBE row (`pri1a-probe-row.mjs`) through the public profile-patch seam, and that row
 *     wires the writer's ports to the host's own `storageDomain` service using the lane's own
 *     `root-binding/harness/seam.mjs` — the same seam the production row is configured with through `seamUrl`.
 *     The writer, the ledger repository, the TeamSession repository and the contract parsers are this worktree's
 *     BUILT artifacts, not a re-implementation;
 *   - the production `dsh-agent-team` row is NOT mounted in the two durability boots, because it opens the same
 *     `team_domain` name and the medium is opened once per process. So these boots measure the writer against
 *     the host's real durable medium across a real process restart; they do NOT measure interleaving with
 *     `ControlService` or any client projection rendering, and this kit does not claim either.
 *
 * THE LEGS (each one is a measurement, and a leg that cannot run is a NAMED refusal — never green, never a
 * false red):
 *   1. write     — created → replay → transferred → retired through the writer, on the host's real medium.
 *   2. generation— `team_sessions.generation` advances once per durable write and not for the replay.
 *   3. raw bytes — the fact-type strings exist in the world's files on disk, read by THIS process, outside the
 *                  host, after the host stopped. This is the leg the in-memory fake could never fake.
 *   4. restart   — a SECOND host process, same `DSH_HOME`, reopens the domain and folds the same three
 *                  rows; the freshness is GRADED (each probe reports its own pid / argv0 marker / module
 *                  nonce, and the driver cross-checks them against the two pids it spawned — round 2 of
 *                  the review killed the `step(id, true, …)` version of this claim).
 *   5. replay    — the first command, re-issued in the fresh process, answers `already` at its ORIGINAL
 *                  sequence and writes nothing.
 *   6. continue  — a new family in the fresh process must land on EXACTLY the next sequence (previousMax+1),
 *                  asserted by the probe and re-derived by the driver from boot 1's rows.
 *
 * ENVIRONMENT. World = `tests/homes/<stamp>-<label>` (workspace-internal, TEST_METHODS §7), deleted at teardown
 * unless `--keep-world`; teardown proves `tests/homes/` is empty again. EVERY port source — the candidate
 * default, `--port`, and the derived restart port — is validated against `TEST_PORT_RANGES` (tests/paths.mjs,
 * the sanctioned-band single source) before any world exists, and `bootWorld` re-asserts band membership
 * immediately before each spawn; out-of-band values are refused naming the bands. 3080 (the stable instance)
 * and 3180 (never rented to worlds) are additionally never bound by this kit; every port is probed before use
 * and proven free after teardown. Process marker `a6pri1a<stamp><label>host<port>` — unique to this run, so
 * teardown kills only what this run started. `DSH_HOME` is set explicitly on every spawn and never inherited.
 * The launch token never reaches evidence: every string that can carry a boot URL passes `scrub()`.
 *
 * Usage: node tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs [--port 3182] [--keep-world] [--self-test]
 * `--self-test` grades this instrument's own FAIL rendering (graded conjuncts, source quotes, the row
 * locator) without creating a world or binding a port, and prints `DSH-PRI1A-REALHOST-SELFTEST verdict=…`.
 * Exit 0 only when every check passed; exit 1 naming the failures; exit 2 with `verdict=port-refused` when a
 * requested port is out of the sanctioned bands (input refusal — nothing was created or booted); exit 3 with
 * `verdict=env-refused` when the environment cannot answer at all (that is a refusal, not a pass and not a red).
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join, relative } from 'node:path'
import { CLIENT_COMMIT_HASH, STABLE_INSTANCE_PORT, TEST_PORT_RANGES, TEST_USE_BASELINE_SHA, isSanctionedTestPort } from '../../paths.mjs'

// The worktree root from THIS file's location — NOT tests/paths.mjs#findTestRepoRoot, which walks upward
// looking for a materialized runtime and can land on a different tree than the one that owns this kit.
const WORKTREE = join(import.meta.dirname, '..', '..', '..')
const RUNTIME = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
const HOMES = join(WORKTREE, 'tests', 'homes')

const argv = process.argv.slice(2)
const KEEP_WORLD = argv.includes('--keep-world')
const SELF_TEST = argv.includes('--self-test')
const PORT_OVERRIDE = (() => {
  const i = argv.indexOf('--port')
  return i >= 0 ? Number(argv[i + 1]) : null
})()

const PORT_CANDIDATES = [3182, 3183, 3184, 3185, 3186, 3187, 3188, 3189]
const FORBIDDEN_PORTS = new Set([3080, 3180])

/**
 * Round 2 (F-I1a1-2): EVERY port source — the candidate default, `--port`, and the derived restart port —
 * is validated against `TEST_PORT_RANGES` (the sanctioned bands in `tests/paths.mjs`, the single source)
 * before it may boot anything, and `bootWorld` re-asserts the band membership immediately before each
 * spawn. An out-of-band value is REFUSED naming the bands; the stable instance (3080) and the manual/§2
 * port (3180) get their own named reasons. This is code, not a comment.
 */
const BANDS_LABEL = TEST_PORT_RANGES.map(([lo, hi]) => `${lo}-${hi}`).join(' / ')
const portBandViolation = (port) => {
  if (!Number.isInteger(port)) return `not an integer: ${String(port)}`
  if (port === STABLE_INSTANCE_PORT) return `${STABLE_INSTANCE_PORT} is the stable development instance — a test may never bind it`
  if (FORBIDDEN_PORTS.has(port)) return `${String(port)} is never bound by this kit (3080 = stable instance; 3180 = never rented to worlds, TEST_METHODS §1)`
  if (!isSanctionedTestPort(port)) return `${String(port)} is outside the sanctioned test bands ${BANDS_LABEL} (tests/paths.mjs TEST_PORT_RANGES)`
  return null
}
const RUN_STAMP = `a6pri1a-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}Z`
const DIST_ROOT = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages')
const PROBE_ROW = `file://${join(import.meta.dirname, 'pri1a-probe-row.mjs')}`
const EVIDENCE_ROOT = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'alpha6-pri1a-real-host')

const ROOT_SESSION = `session-a6pri1a-host-${RUN_STAMP.slice('a6pri1a-'.length)}`
const CASE_ID = 'approval-case-a6pri1a'
const FACT_TYPES = ['review-assignment-created', 'review-assignment-transferred', 'review-assignment-retired']

const lines = []
const log = (s) => { lines.push(String(s)); console.log(String(s)) }
/** The launch token never leaves this file: anything that can carry a boot URL is scrubbed before storage. */
const scrub = (s) => String(s).replace(/([?&]token=)[^&#\s]*/g, '$1<REDACTED>')

const results = []
/**
 * PASS/FAIL only for legs that RAN. `refuse()` records a leg that could not run — never green, never red.
 *
 * `graded` (F-I1a2-1, review round 2) is the list of CONJUNCTS a leg actually evaluated. On FAIL every one
 * of them is printed — which side of the instrument computed it, the `file:line` it was graded from, the
 * value each side produced — and the SOURCE BYTES of each conjunct's ARM are quoted from the kit files as
 * they sit on disk during this run. Round 2's committed reds were self-consistent and could only be
 * explained by trusting the README, which is what a falsifiability transcript must never need; a mutated
 * arm now shows its own mutated bytes in the transcript. What is quoted is the arm's DECLARED region —
 * containment over the certified span, not a statement-boundary proof — and the arm's own inputs are
 * not quoted (F-I1a3-4), so a mutation of an input line reddens the leg with the quoted bytes pristine.
 */
const check = (id, ok, measured, graded = null) => {
  const rendered = ok === true || graded === null ? null : graded.map(renderConjunct)
  results.push({ id, verdict: ok === true ? 'PASS' : 'FAIL', measured: String(measured), ...(rendered === null ? {} : { graded: rendered }) })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${id} — ${scrub(measured)}`)
  if (rendered !== null) {
    log(`FAIL-GRADED ${id} — ${String(rendered.length)} conjunct(s) this leg evaluated; each prints its descriptor's DECLARED region — every printed line verified live on disk, carrying its signature uniquely within the certified span, on code, which is containment, not a statement-boundary proof (arm bytes only — an arm's own inputs are not quoted, so a mutation of an input reddens the leg with these bytes pristine):`)
    for (const c of rendered) {
      log(`FAIL-GRADED   ${c.ok ? 'ok  ' : 'RED '} [${c.side}] ${c.at} — ${c.what}: ${scrub(c.values)}`)
      for (const s of c.source ?? []) log(`FAIL-GRADED     ${scrub(s)}`)
    }
  }
}
const refuse = (id, cause) => {
  results.push({ id, verdict: 'REFUSED', measured: String(cause) })
  log(`REFUSED ${id} — ${scrub(cause)}`)
}

const gitOut = (args, cwd) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()
const porcelainCount = (tree) => gitOut(['status', '--porcelain'], tree).split('\n').filter((l) => l !== '').length

const portInUse = (port) => new Promise((resolve) => {
  const socket = createConnection({ host: '127.0.0.1', port })
  socket.setTimeout(1500)
  socket.once('connect', () => { socket.destroy(); resolve(true) })
  socket.once('timeout', () => { socket.destroy(); resolve(false) })
  socket.once('error', () => { socket.destroy(); resolve(false) })
})

/** Every regular file under `dir` (worlds are small; the guard is depth, not size). */
function filesUnder(dir, depth = 0, out = []) {
  if (depth > 8) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) filesUnder(abs, depth + 1, out)
    else if (entry.isFile()) out.push(abs)
  }
  return out
}

// ── F-I1a2-1 (round 3): a FAIL prints WHAT IT GRADED ────────────────────────────────────────────────────
// Worktree-relative, so a transcript can carry a source quote without ever carrying an absolute path.
const DRIVER_REL = relative(WORKTREE, join(import.meta.dirname, 'pr-i1a-real-host.mjs'))
const PROBE_REL = relative(WORKTREE, join(import.meta.dirname, 'pri1a-probe-row.mjs'))

/**
 * Every arm this instrument quotes by ANCHOR, recorded as it is built (F-I1a3-1). `--self-test` walks THIS
 * list and resolves each entry with its own span, so no descriptor can be a transcription of a line number.
 *
 * What a quoted span IS guaranteed, checked at registration and again against the bytes on disk at grade
 * time: the descriptor was returned by `bareQuote`/`armDescriptor` (not spread-copied, not hand-written —
 * F-I1a4-1/S5, F-I1a4-3/4), its anchor matches exactly one line of its file, every line of its span
 * contains that line's own signature token, every signature token is carried by EXACTLY ONE line of the
 * span it certifies, and no span line is blank or comment-only. "Unique" is defined against the span, not
 * the whole file, and the choice is disclosed: the reviewer's plant A2 inserts a byte-identical copy of a
 * certified line, so the same token legitimately sits on two file lines while the quoted span line is a
 * correct, verbatim line of the arm — whole-file uniqueness would REFUSE a quote that is byte-exact and
 * graded from live code, refusing a correct answer is not what refusing exists for. What no reading
 * allows, and what the grade-time rules therefore refuse: a token shared by two lines of the span (it
 * cannot say which line is its line), a blank token (contained in every line), a comment or blank line
 * certifying (plant D's inserted comment), and any descriptor that skipped the builder. The STRICTER
 * whole-file distinctness of signature tokens is graded where it is cheap and stable — in `--self-test`,
 * per registered arm, against the file (`arm-signature-tokens-occur-once-in-file …`) — so a token that
 * gains a second home anywhere in a kit file turns the self-test red and forces a human to look, even
 * when boot-time quoting of that arm would remain legal under the span rule.
 *
 * What that does NOT buy, stated here because the FAIL header states it too (F-I1a4-1, round 4): none of it
 * is a statement-boundary proof, and byte containment cannot tell a token executing as code from the same
 * bytes inside a string, a comment or a regex literal. So a graded quote has THREE outcomes, not two: (1)
 * every check above passes and the span prints — as the region the descriptor DECLARES, which may still be
 * a wider or narrower cut of correct code than the statement the arm names, and may still contain a
 * signature that survives there only as string, comment or regex-literal content — measured instances,
 * not a prose class: the reviewer's A6 is string content, and round 5 measured comment content (N3,
 * planted-file sha 09637367…) and regex-literal content (N2, planted-file sha 77884683…) certify
 * `verdict=pass checks=55 problems=0` the same way at 64f005cde; (2) a check above fails and the arm is
 * REFUSED, with the reason printed where the bytes would have been; (3) — the case round 4 named — a
 * descriptor whose declared region is live, signature-distinct code but is NOT the arm's statement is
 * published confidently as declared. The honest scope: the instrument guarantees every quoted line is a
 * live, signature-unique line of the file the arm lives in, and it refuses the misquote classes it can see
 * in bytes; it does not certify that a published region is the statement itself. (Driver conjuncts are
 * quoted by their own label instead, and the self-test sweeps those labels separately.)
 */
const ARM_DESCRIPTORS = []

/**
 * One quotable arm. `anchor` must match exactly one line and the quote STARTS on that line — there is no
 * `from` offset any more, because an offset measured nothing: round 3 inserted one comment line between an
 * anchor and its arm and the instrument printed the comment as "the bytes it was graded from" while a green
 * `--self-test` watched. The span is `lines` long and EVERY line of it must contain its own signature token
 * (`anchor` for the first line, one `armFromLine2` token for each later line) before any byte of it prints.
 * A signature that no longer matches says the arm moved or was rewritten, and the quote is refused.
 *
 * Round 4 adds the two construction-time rules (F-I1a4-1 items 1–2, F-I1a4-3/4):
 * * No signature token may be blank. `''` or whitespace-only is contained in EVERY line, so it certifies
 *   nothing — the builder refuses to return such a descriptor at all (the reviewer's A5b/A12 widened spans
 *   were signed with `''`; at these bytes they never reach grade time).
 * * Whatever this function returns is seated in `BUILT_DESCRIPTORS`, and `locate()` quotes only what is
 *   seated there. A spread copy (`{ ...ARM_SELFTEST, lines: 4 }`, the reviewer's S5) and an object literal
 *   (their A10 factory) skip both the registration rules and the seat, so they are refused as shapes, not
 *   scanned for spellings — round 4 measured aliases, `["fr"+"om"]` computed keys, spreads and factory
 *   descriptors walking past the source scans at 41/41; none of those spellings changes this rule.
 */
const BUILT_DESCRIPTORS = new WeakSet()
const blankToken = (t) => typeof t !== 'string' || t.trim() === ''
function bareQuote(file, anchor, lines = 1, armFromLine2 = []) {
  if (!Number.isInteger(lines) || lines < 1) throw new Error(`arm descriptor ${JSON.stringify(anchor)}: lines must be an integer >= 1`)
  if (armFromLine2.length !== lines - 1) {
    throw new Error(`arm descriptor ${JSON.stringify(anchor)}: ${String(lines)} quoted line(s) need ${String(lines - 1)} signature token(s), got ${String(armFromLine2.length)}`)
  }
  if (blankToken(anchor)) throw new Error(`arm descriptor: signature token 1 (the anchor) is ${JSON.stringify(anchor)} — a blank token is contained in every line and certifies no line; refusing to register`)
  armFromLine2.forEach((token, k) => {
    if (blankToken(token)) throw new Error(`arm descriptor ${JSON.stringify(anchor)}: signature token ${String(k + 2)} is ${JSON.stringify(token)} — a blank token is contained in every line and certifies no line; refusing to register`)
  })
  const descriptor = Object.freeze({ file, anchor, lines, signatures: Object.freeze([anchor, ...armFromLine2]) })
  BUILT_DESCRIPTORS.add(descriptor)
  return descriptor
}

/** An arm the self-test must resolve: identical to `bareQuote`, plus a seat in the registry it walks. */
function armDescriptor(file, anchor, lines = 1, armFromLine2 = []) {
  const descriptor = bareQuote(file, anchor, lines, armFromLine2)
  ARM_DESCRIPTORS.push(descriptor)
  return descriptor
}

/** The quote a driver conjunct gets when it names no arm: its own label, which sits on its arm's line. */
const labelQuote = (what) => bareQuote(DRIVER_REL, what)

/**
 * One conjunct of a graded leg: which SIDE of the instrument computed it (the in-host probe or this driver),
 * what it asserts, the values it saw, and where its bytes live. A driver conjunct with no explicit `quote`
 * is located by its own label, which must therefore be unique in this file — that is what makes the printed
 * `file:line` a measurement of the running bytes rather than a transcription that can drift.
 */
const conjunct = (side, what, ok, values, quote = null) => ({
  side,
  what,
  ok: ok === true,
  values: String(values),
  quote: quote ?? labelQuote(what),
})

/**
 * The four arms quoted out of the PROBE, each anchored on its own line and carrying the signature of every
 * line its span covers. The two handoff arms are the arm line itself (`rows` is handed back there), NOT a
 * fixed number of lines under the `emit(` anchor — that offset was the round-3 defect.
 */
const ARM_REOPEN_PROBE = armDescriptor(PROBE_REL, 'const freshProcess =', 2, ['previousBootArgv0 !== process.argv0'])
const ARM_BOOT1_HANDOFF = armDescriptor(PROBE_REL, 'writes: { created, replay, transferred, retired }, rows,')
const ARM_BOOT2_HANDOFF = armDescriptor(PROBE_REL, 'generation, replayFirst, fresh,')
const ARM_NEW_FAMILY_STEP = armDescriptor(PROBE_REL, "step('new-family-writes-after-restart'", 4, ['JSON.stringify(fresh.ok', 'applied: fresh.applied', 'refusal: fresh.refusal'])
/** The self-test's own arm, so the FAIL-rendering checks quote bytes that exist and are measurable. */
const ARM_SELFTEST = armDescriptor(DRIVER_REL, 'const ARM_SELFTEST =')

/**
 * Locate one registered `{file, anchor, lines, signatures}` descriptor in the bytes actually on disk NOW.
 * Everything the registration rules can re-grade against bytes is re-graded here, at grade time, so the
 * refusal names what the disk says — shape and seat first (a descriptor that was never built certifies
 * nothing about any file), then the anchor, then the span's containment, then each token's DISTINCTIVENESS
 * WITHIN THE SPAN it certifies (round 4: containment proved the line carried the token, never that the
 * token was the span's own — an inserted line carrying the signature certified itself), then that the span
 * lands on code. The span-wide (not file-wide) reading of "unique" is defined and defended in the registry
 * comment above: a byte-identical copy of a certified line elsewhere in the file stays quotable (plant A2);
 * a comment or blank line never certifies (plant D), and a token shared by two span lines refuses.
 * A published span is the descriptor's DECLARED region verified by these checks; it is not, and does not
 * claim to be, a statement-boundary proof (see the registry comment above).
 */
function locate(quote) {
  const file = quote.file
  let text = null
  try { text = readFileSync(join(WORKTREE, file), 'utf8') } catch { text = null }
  if (text === null) return { at: `${file}:<unreadable>`, lines: [`${file}:<the file that declares this conjunct could not be read>`] }
  if ('from' in quote) {
    return {
      at: `${file}:<descriptor carries a from offset>`,
      lines: [`${file}:<a from offset is a transcription, not a measurement — anchor the descriptor on its arm's own line instead; REFUSING to quote>`],
    }
  }
  if (!BUILT_DESCRIPTORS.has(quote)) {
    return {
      at: `${file}:<descriptor was not built by the builder>`,
      lines: [`${file}:<only a descriptor returned by bareQuote/armDescriptor may be quoted — a spread copy or an object literal skipped every registration rule this instrument relies on; REFUSING to quote>`],
    }
  }
  const lines = quote.lines
  const signatures = quote.signatures
  if (!Number.isInteger(lines) || lines < 1 || !Array.isArray(signatures) || signatures.length !== lines || signatures.some(blankToken)) {
    return {
      at: `${file}:<descriptor shape invalid>`,
      lines: [`${file}:<${String(lines)} span line(s) with ${Array.isArray(signatures) ? String(signatures.length) : 'no'} signature token(s), some blank — every quoted line must carry its own non-blank signature; REFUSING to quote>`],
    }
  }
  const all = text.split('\n')
  const hits = []
  all.forEach((l, i) => { if (l.includes(quote.anchor)) hits.push(i) })
  if (hits.length !== 1) {
    return {
      at: `${file}:<anchor matched ${String(hits.length)} lines>`,
      lines: [`${file}:<anchor ${JSON.stringify(quote.anchor)} matched ${String(hits.length)} lines, not 1 — this quote is NOT the graded arm>`],
    }
  }
  const from = hits[0]
  const span = []
  for (let i = from; i < from + lines; i += 1) span.push(i < all.length ? all[i] : undefined)
  const drift = signatures.findIndex((token, k) => typeof span[k] !== 'string' || !span[k].includes(token))
  if (drift >= 0) {
    return {
      at: `${file}:<span drifted>`,
      lines: [`${file}:<line ${String(from + drift + 1)} of this arm's ${String(lines)}-line span does not contain its signature ${JSON.stringify(signatures[drift])} — the arm moved or was rewritten; REFUSING to quote bytes it did not grade>`],
    }
  }
  const repeated = signatures
    .map((token, k) => ({ token, k, occurrences: span.reduce((n, l) => (typeof l === 'string' && l.includes(token) ? n + 1 : n), 0) }))
    .filter((d) => d.occurrences !== 1)
  if (repeated.length > 0) {
    const d = repeated[0]
    return {
      at: `${file}:<signature not unique>`,
      lines: [`${file}:<signature ${JSON.stringify(d.token)} (span line ${String(d.k + 1)}) is carried by ${String(d.occurrences)} lines of this arm's ${String(lines)}-line span — a token carried by more than one line cannot say which line the arm is on; REFUSING to pick a match>`],
    }
  }
  const offCode = span.map((l, k) => ({ k, t: (l ?? '').trim() })).find(({ t }) => t === '' || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*'))
  if (offCode !== undefined) {
    return {
      at: `${file}:<span not on code>`,
      lines: [`${file}:<line ${String(from + offCode.k + 1)} of this arm's ${String(lines)}-line span is a blank or comment line — containment cannot turn bytes into a statement boundary, and a declared span must at least land on code; REFUSING to quote>`],
    }
  }
  const quoted = []
  for (let i = from; i < from + lines; i += 1) {
    quoted.push(`${file}:${String(i + 1)} ${all[i].replace(/\s+/g, ' ').trim()}`)
  }
  return { at: `${file}:${String(from + 1)}`, lines: quoted }
}

/** Resolve a conjunct into the record a FAIL transcript prints: side, file:line, values, source bytes. */
function renderConjunct(c) {
  const quotes = Array.isArray(c.quote) ? c.quote : [c.quote]
  const located = quotes.map(locate)
  return {
    side: c.side,
    what: c.what,
    ok: c.ok,
    values: c.values,
    at: located.map((l) => l.at).join(' + '),
    source: located.flatMap((l) => l.lines),
  }
}

const brief = (v) => String(typeof v === 'string' ? JSON.stringify(v.slice(0, 80)) : JSON.stringify(v) ?? String(v)).slice(0, 120)

/**
 * F-I1a2-2: the rows leg compares two JSON strings and its FAIL line truncates each side to 400 chars, so a
 * payload difference in the third row was invisible. The truncation stays — the transcript has to stay
 * readable — and this adds the LOCATOR: the first row that differs, the dotted field path inside it, and what
 * each side reported. When every leaf matches but the strings still differ, the honest answer is that the
 * comparison is `JSON.stringify` equality, which grades key ORDER too, and that is what gets said.
 */
function firstRowDifference(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return `row COUNT/CAPTURE: boot 1 side is ${a === null ? 'null (no boot-1 report)' : typeof a}, boot 2 side is ${b === null ? 'null (no rows reported)' : typeof b}`
  }
  if (a.length !== b.length) return `row COUNT: boot 1 handed back ${String(a.length)} row(s), boot 2 ${String(b.length)} row(s)`
  for (let i = 0; i < a.length; i += 1) {
    const d = firstValueDifference(a[i], b[i], `rows[${String(i)}]`)
    if (d !== null) return d
  }
  const order = firstKeyOrderDifference(a, b)
  if (order !== null) return order
  return 'FIELD PATH: nothing differs — the two captures are equal, so a difference reported here would be a fault in this instrument, not in the writer'
}

/** The leg grades a JSON-string equality, which grades key ORDER too; this names that case explicitly. */
function firstKeyOrderDifference(a, b, path = 'rows') {
  for (let i = 0; i < a.length; i += 1) {
    const d = keyOrderOf(a[i], b[i], `${path}[${String(i)}]`)
    if (d !== null) return d
  }
  return null
}

function keyOrderOf(x, y, path) {
  if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) return null
  const kx = Object.keys(x)
  const ky = Object.keys(y)
  if (kx.length === ky.length && JSON.stringify(kx) !== JSON.stringify(ky) && JSON.stringify(kx.slice().sort()) === JSON.stringify(ky.slice().sort())) {
    return `FIELD PATH ${path}: every value matches and the KEY ORDER differs (boot 1 ${kx.join(',')} vs boot 2 ${ky.join(',')}), and the leg grades a JSON.stringify equality, which grades order`
  }
  for (const k of kx) {
    const d = keyOrderOf(x[k], y[k], `${path}.${k}`)
    if (d !== null) return d
  }
  return null
}

/** Depth-first, first difference wins; arrays and objects are both walked by their own keys. */
function firstValueDifference(x, y, path) {
  if (x === y) return null
  const objX = typeof x === 'object' && x !== null
  const objY = typeof y === 'object' && y !== null
  if (!objX || !objY) return `FIELD PATH ${path}: boot 1 ${brief(x)} vs boot 2 ${brief(y)}`
  if (Array.isArray(x) !== Array.isArray(y)) return `FIELD PATH ${path}: one side is an array, the other is not`
  if (Array.isArray(x) && x.length !== y.length) return `FIELD PATH ${path}: ${String(x.length)} item(s) in boot 1 vs ${String(y.length)} in boot 2`
  const kx = Object.keys(x)
  const ky = Object.keys(y)
  const lonely = [...new Set([...kx, ...ky])].find((k) => !Object.prototype.hasOwnProperty.call(x, k) || !Object.prototype.hasOwnProperty.call(y, k))
  if (lonely !== undefined) {
    const inBoot1 = Object.prototype.hasOwnProperty.call(x, lonely)
    return `FIELD PATH ${path}.${lonely}: ${inBoot1 ? 'absent in boot 2' : 'absent in boot 1'} (present side ${brief(inBoot1 ? x[lonely] : y[lonely])})`
  }
  for (const k of kx) {
    const d = firstValueDifference(x[k], y[k], `${path}.${k}`)
    if (d !== null) return d
  }
  return null
}

/**
 * `--self-test` grades the FAIL-rendering machinery WITHOUT booting anything, so the claim "a FAIL prints
 * what it graded" is itself measured and not just asserted in prose: every driver conjunct label and every
 * registered arm must resolve to the bytes it claims — with its OWN span, not `lines: 1` and a default
 * offset (F-I1a3-1: the round-17 sweep re-located anchors only, so the offsets under them were never graded
 * and a shifted arm printed its neighbour as "the bytes it was graded from" past a green self-test) — a
 * drifted span or a missing anchor must refuse to quote, a synthetic red leg must render its graded block,
 * the row locator must name the row/field that differs, and no descriptor may be hand-written in the source
 * where the sweep cannot reach it. Exit 0 only when every assertion holds.
 *
 * Its ceiling is disclosed rather than argued away (F-I1a3-3 — LEFT OPEN; nothing here or below closes
 * it): an assertion here that is rewritten to a constant `true` still passes, because nothing grades the
 * assertions themselves. Round 4 MEASURED that meta-ceiling, and the count said nothing about it: five
 * assertions across four families were emptied to constants and `checks=41 problems=0` still printed.
 * A published count is a count, never a claim of meaningfulness; what a check is worth is shown by the
 * named plant that moves its exit code. Every round re-runs this.
 */
function selfTest() {
  const problems = []
  let assertions = 0
  const expect = (name, ok, detail) => {
    assertions += 1
    if (ok === true) log(`SELFTEST ok ${name}`)
    else { problems.push(name); log(`SELFTEST PROBLEM ${name} — ${String(detail)}`) }
  }

  const selfTestArm = conjunct('driver', 'selftest graded arm', false, 'spawned boot 1=1 boot 2=1', ARM_SELFTEST)
  const renderedRed = renderConjunct(selfTestArm)
  expect('driver-conjunct-resolves-to-a-line', /pr-i1a-real-host\.mjs:\d+$/.test(renderedRed.at), renderedRed.at)
  expect('driver-conjunct-quotes-its-own-bytes', (renderedRed.source[0] ?? '').includes('ARM_SELFTEST'), JSON.stringify(renderedRed.source))

  const absentQuote = bareQuote(DRIVER_REL, ['this', 'anchor', 'is', 'deliberately', 'absent'].join(' '))
  const absentLabel = ['selftest', 'absent', 'anchor', 'case'].join(' ')
  const missing = renderConjunct(conjunct('driver', absentLabel, false, 'x', absentQuote))
  expect('missing-anchor-says-so', missing.at.includes('<anchor matched 0 lines>'), missing.at)
  expect('missing-anchor-refuses-to-quote', missing.source.length === 1 && missing.source[0].includes('NOT the graded arm'), JSON.stringify(missing.source))

  // F-I1a3-1, the guard the round-17 self-test did not have. Round 3 planted one comment line between an
  // anchor and the arm it pointed `from: 2` ahead to, and the instrument quoted that comment as its own
  // source while `--self-test` stayed green. These two descriptors are that plant, expressed as data: the
  // anchor is a real line, the span is one line deeper than the arm, and the signature says what the arm is.
  // (The anchor is taken from ARM_SELFTEST rather than re-typed, because writing it again here would be the
  // duplicate-anchor bug these very checks grade.)
  const plantedSpan = bareQuote(DRIVER_REL, ARM_SELFTEST.anchor, 2, ['the arm moved, this token is on no line here'])
  const planted = locate(plantedSpan)
  expect('shifted-span-refuses-to-quote', planted.at.includes('<span drifted>'), planted.at)
  expect('shifted-span-quotes-no-pretend-source', planted.lines.length === 1 && planted.lines[0].includes('REFUSING to quote'), JSON.stringify(planted.lines))
  expect('shifted-span-names-the-line-it-could-not-verify', /line \d+ of this arm's 2-line span/.test(planted.lines[0] ?? ''), JSON.stringify(planted.lines))
  // The offset case is built with a computed key: writing a literal `from: 2` here would trip the
  // tripwire scan at the end of this function, whose whole job is catching that common spelling written
  // as a descriptor. Since round 4's fix this is a LEGITIMATE construction site, not a hidden exception
  // (F-I1a4-3): the rule itself is construction- and grade-time — locate() refuses any descriptor that
  // carries a from offset (checked first, so this shape gets the named from-offset refusal rather than
  // the unbuilt one) and refuses anything the builder never returned — and no alias, computed key or
  // spread changes what those checks see. The scan is a tripwire over one spelling; this line exists to
  // prove the rule behind it bites.
  const offsetKey = ['fr', 'om'].join('')
  const offsetQuote = { ...labelQuote(ARM_SELFTEST.anchor), [offsetKey]: 2 }
  const withOffset = locate(offsetQuote)
  expect('from-offset-is-refused-not-measured', withOffset.at.includes('<descriptor carries a from offset>') && withOffset.lines[0].includes('REFUSING to quote'), `${withOffset.at} ${JSON.stringify(withOffset.lines)}`)

  // F-I1a4-1, items 1–2, as data: the shapes that PUBLISHED CONFIDENTLY at the round-18 bytes — a blank
  // signature token (the widened A5b/A12 spans were signed with `''` and `''` is contained in every line),
  // a spread of a built descriptor (S5: `{ ...ARM_SELFTEST, lines: 4 }` printed four lines, one verified),
  // a signature carried by more than one line of its own span (the general shape of plant D: an inserted
  // line carrying a signature certified itself; here the token `const ` is carried by BOTH lines of the
  // two-line span it would certify, so it cannot say which line the arm is on — under the span-wide
  // reading disclosed in the registry comment, a token duplicated OUTSIDE the span, like plant A2's
  // byte-identical copy, stays legal and the self-test's per-arm file-wide sweep is what goes red), and a
  // span line that is a comment (A12's `/** …` line, called the arm's bytes). Every refusal below is the
  // instrument refusing a SHAPE at construction or grade time — not a scan noticing a spelling: round 4
  // walked both scans at 41/41 green using aliases, computed keys, spreads and factories (F-I1a4-3/4), so
  // the scans are a tripwire for the two common spellings and these checks are the rule.
  let blankRefused = ''
  try {
    bareQuote(DRIVER_REL, ARM_SELFTEST.anchor, 2, [''])
    bareQuote(DRIVER_REL, ARM_SELFTEST.anchor, 2, ['   '])
  } catch (e) { blankRefused = String(e.message ?? e) }
  expect('blank-signature-token-refuses-at-registration', blankRefused.includes('refusing to register'), blankRefused === '' ? 'bareQuote RETURNED a descriptor signed with a blank token — the builder no longer refuses it' : blankRefused)
  const spreadCopy = locate({ ...ARM_SELFTEST })
  expect('spread-of-a-built-descriptor-refuses-to-quote', spreadCopy.at.includes('<descriptor was not built by the builder>'), `${spreadCopy.at} ${JSON.stringify(spreadCopy.lines)}`)
  const dupToken = locate(bareQuote(PROBE_REL, 'const previousMax =', 2, ['const ']))
  expect('span-duplicated-signature-refuses-certification', dupToken.at.includes('<signature not unique>'), `${dupToken.at} ${JSON.stringify(dupToken.lines)}`)
  // The anchor is assembled, not re-typed: this line would otherwise contain the very string it locates,
  // which is the duplicate-anchor bug the anchor rule grades (same reason plantedSpan borrows ARM_SELFTEST's
  // anchor instead of writing it out). The pieces appear on this line only; the full anchor is on one.
  const commentAnchor = [' * ', 'The four arms ', 'quoted out of the PROBE'].join('')
  const commentSpan = locate(bareQuote(DRIVER_REL, commentAnchor))
  expect('comment-line-in-a-span-refuses-to-quote', commentSpan.at.includes('<span not on code>'), `${commentSpan.at} ${JSON.stringify(commentSpan.lines)}`)

  const before = lines.length
  check('selftest-renders-a-graded-fail', false, 'synthetic leg — nothing about the writer was measured here', [selfTestArm])
  const block = lines.slice(before)
  expect('fail-prints-a-graded-block', block.some((l) => l.startsWith('FAIL-GRADED selftest-renders-a-graded-fail')), block.join(' | '))
  expect('graded-block-marks-the-red-arm', block.some((l) => l.includes('RED ') && /pr-i1a-real-host\.mjs:\d+/.test(l)), block.join(' | '))
  results.length = 0

  const baseRows = [1, 2, 3].map((s) => ({ schemaVersion: 2, sequence: s, factType: `f${String(s)}`, payload: { assignmentEpoch: 1, legRequestId: `leg-${String(s)}` }, createdAt: 't' }))
  const copy = (rows) => rows.map((r) => ({ ...r, payload: { ...r.payload } }))
  expect('equal-rows-claim-no-difference', firstRowDifference(baseRows, copy(baseRows)).includes('nothing differs'), firstRowDifference(baseRows, copy(baseRows)))
  expect('third-row-payload-difference-is-located', firstRowDifference(baseRows, baseRows.map((r, i) => (i === 2 ? { ...r, payload: { ...r.payload, assignmentEpoch: 99 } } : r))) === 'FIELD PATH rows[2].payload.assignmentEpoch: boot 1 1 vs boot 2 99', firstRowDifference(baseRows, baseRows.map((r, i) => (i === 2 ? { ...r, payload: { ...r.payload, assignmentEpoch: 99 } } : r))))
  expect('row-count-difference-is-located', firstRowDifference(baseRows, baseRows.slice(0, 2)).startsWith('row COUNT:'), firstRowDifference(baseRows, baseRows.slice(0, 2)))
  expect('key-order-difference-is-named', firstRowDifference(baseRows, baseRows.map((r) => Object.fromEntries(Object.keys(r).reverse().map((k) => [k, r[k]])))).includes('KEY ORDER'), firstRowDifference(baseRows, baseRows.map((r) => Object.fromEntries(Object.keys(r).reverse().map((k) => [k, r[k]])))))
  expect('missing-field-is-named', firstRowDifference(baseRows, baseRows.map(({ createdAt, ...r }, i) => (i === 1 ? r : { createdAt, ...r }))).includes('rows[1].createdAt: absent in boot 2'), firstRowDifference(baseRows, baseRows.map(({ createdAt, ...r }, i) => (i === 1 ? r : { createdAt, ...r }))))

  const source = readFileSync(join(WORKTREE, DRIVER_REL), 'utf8')
  const labels = [...source.matchAll(/conjunct\('driver', '([^']+)'/g)].map((m) => m[1])
  expect('driver-conjuncts-are-present', labels.length >= 9, `found ${String(labels.length)}`)
  for (const label of labels) {
    const located = locate(labelQuote(label))
    expect(`label-locates-uniquely "${label}"`, !located.at.includes('<'), located.at)
  }

  // The sweep round 3 asked for, GRADED FOR DISTINCTIVENESS since round 4 (F-I1a4-1 item 4). The round-18
  // sweep checked a descriptor against its OWN transcription — `arm-quotes-its-own-span` re-derived the
  // span from the descriptor's `lines`/`signatures`, and `arms-are-registered-for-the-sweep` was a
  // `length >= 5` — which grades self-consistency, not distinctiveness: the reviewer's plants D/A5b/A6/A12
  // kept every one of those green. What follows grades each arm against the FILE — a SECOND, STRICTER
  // layer that runs only here: every signature token must occur on exactly one line of the file the
  // descriptor points at, and every span line must land on code, not on a blank or a comment line. The
  // boot-time quote rule stays the span-wide one defined in the registry comment (a byte-identical copy
  // outside the span, plant A2, remains quotable because what prints is still verbatim live code); a
  // token that gains a second home anywhere in a kit file turns THIS sweep red and forces a human to
  // look. `lines`/`signatures` are still taken from the descriptor, never re-typed here, so a descriptor
  // cannot pass by being shorter than what a leg quotes.
  const registrationCalls = (source.match(/= armDescriptor\(/g) ?? []).length
  expect('arms-are-registered-for-the-sweep', ARM_DESCRIPTORS.length === registrationCalls && ARM_DESCRIPTORS.length >= 5, `registered ${String(ARM_DESCRIPTORS.length)} against ${String(registrationCalls)} registration call(s) in the source`)
  for (const d of ARM_DESCRIPTORS) {
    const located = locate(d)
    expect(`arm-resolves ${d.anchor}`, !located.at.includes('<'), located.at)
    const spanOk = located.lines.length === d.lines
      && located.lines.every((printed, k) => printed.includes(`:${String(Number(located.at.split(':')[1]) + k)} `) && printed.includes(d.signatures[k]))
    expect(`arm-quotes-its-own-span ${d.anchor}`, spanOk, JSON.stringify(located.lines))
    const fileLines = readFileSync(join(WORKTREE, d.file), 'utf8').split('\n')
    const anchorLines = fileLines.reduce((xs, l, i) => (l.includes(d.anchor) ? [...xs, i] : xs), [])
    const repeated = d.signatures
      .map((token, k) => ({ token, spanLine: k + 1, occurrences: fileLines.reduce((n, l) => (l.includes(token) ? n + 1 : n), 0) }))
      .filter((x) => x.occurrences !== 1)
    expect(`arm-signature-tokens-occur-once-in-file ${d.anchor}`, repeated.length === 0, JSON.stringify(repeated))
    const notCode = (anchorLines.length === 1 ? fileLines.slice(anchorLines[0], anchorLines[0] + d.lines) : [])
      .map((l, k) => ({ spanLine: k + 1, text: l.trim().slice(0, 60) }))
      .filter(({ text }) => text === '' || text.startsWith('//') || text.startsWith('/*') || text.startsWith('*'))
    expect(`arm-span-lands-on-code ${d.anchor}`, anchorLines.length === 1 && notCode.length === 0, JSON.stringify(notCode))
  }
  // …and the tripwire scans for the two common wrong shapes written out in the open: a hand-written
  // descriptor literal, and a literal `from:` offset. They are a TRIPWIRE, disclosed as one (F-I1a4-3/4):
  // round 4 passed aliases, `["fr"+"om"]` computed keys, spreads and factory-built descriptors through
  // them at 41/41, so the RULE is enforced where a descriptor is built (bareQuote's refusals + the seat
  // in BUILT_DESCRIPTORS) and where it is used (locate's seat/shape/from refusals) — a spelling that
  // walks past a scan still cannot produce a quote. Leading-comment lines are excluded, so a comment may
  // explain the rule by naming the shape it forbids; code with a trailing comment is still scanned.
  const code = source.split('\n').filter((l) => {
    const t = l.trimStart()
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))
  }).join('\n')
  expect('no-descriptor-is-hand-written-in-the-code', code.match(/\bfile:\s*(DRIVER_REL|PROBE_REL)/g) === null, JSON.stringify(code.match(/\bfile:\s*(DRIVER_REL|PROBE_REL)/g)))
  expect('no-descriptor-carries-a-from-offset', code.match(/\bfrom:\s*\d/g) === null, JSON.stringify(code.match(/\bfrom:\s*\d/g)))

  log(`DSH-PRI1A-REALHOST-SELFTEST verdict=${problems.length === 0 ? 'pass' : 'fail'} checks=${String(assertions)} problems=${String(problems.length)}${problems.length === 0 ? '' : ` failed=${problems.join(',')}`}`)
  return problems.length === 0 ? 0 : 1
}

/**
 * Boot one host over one world and hand back its readiness seam. `mode` selects the probe scenario; the SAME
 * world is booted twice (write, then restart) so the restart crosses a real process boundary. The port is
 * re-validated against TEST_PORT_RANGES HERE, immediately before the spawn — every caller, present or future,
 * passes through this gate. `previousBoot` (pid + argv0 marker of the earlier boot) is handed to the restart
 * probe so the reopen step can assert a different process instead of asserting `true`.
 */
async function bootWorld({ label, port, mode, home, reportPath, previousBoot = null }) {
  const bandViolation = portBandViolation(port)
  if (bandViolation !== null) throw new Error(`${label}: port ${String(port)} rejected immediately before boot — ${bandViolation}`)
  const logPath = join(home, `host-${label}.log`)
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const probeConfig = {
    mode,
    rootSessionId: ROOT_SESSION,
    approvalCaseId: CASE_ID,
    workspace: home,
    reportPath,
    distRoot: `file://${DIST_ROOT}/`,
    ...(previousBoot === null ? {} : { previousBootPid: previousBoot.pid, previousBootArgv0: previousBoot.argv0 }),
  }
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), [
    `# PR-I1a real-host instrument (world ${RUN_STAMP}-${label}): the probe row that drives THIS worktree's BUILT`,
    '# durable writer over the host storageDomain service, mounted ONLY through the public profile-patch seam',
    '# (CORE PATCH BUDGET = 0). The production dsh-agent-team row is deliberately absent: it owns the same',
    '# team_domain name, and these boots measure the writer against the medium, not against the composition.',
    '- insert:',
    '  - id: a6pri1a-probe',
    `    name: ${PROBE_ROW}`,
    '    config:',
    ...Object.entries(probeConfig).map(([k, v]) => `      ${k}: ${JSON.stringify(v)}`),
    '',
  ].join('\n'))

  writeFileSync(logPath, '')
  const fd = openSync(logPath, 'a')
  const marker = `a6pri1a${RUN_STAMP.replace(/[^a-z0-9]/g, '')}${label}host${port}`
  const child = spawn('/bin/bash', ['-c', `exec -a ${marker} node apps/cli/lib/bin.js web --port ${port} --no-open`], {
    cwd: RUNTIME, stdio: ['ignore', fd, fd],
    env: { ...process.env, DSH_HOME: home, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH },
  })
  log(`${label}: spawned marker=${marker} port=${port} DSH_HOME=${relative(WORKTREE, home)}`)

  let bootUrl = null
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline && bootUrl === null) {
    await new Promise((r) => setTimeout(r, 1000))
    const m = /dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/.exec(readFileSync(logPath, 'utf8'))
    if (m) bootUrl = m[1]
  }
  if (bootUrl === null) {
    const tail = readFileSync(logPath, 'utf8').split('\n').slice(-40).join('\n')
    child.kill('SIGKILL')
    throw new Error(`${label}: no boot line within 240s. log tail:\n${scrub(tail)}`)
  }
  const token = new URL(bootUrl).searchParams.get('token')
  const origin = `http://127.0.0.1:${port}`
  const auth = await fetch(`${origin}/?token=${token}`, { redirect: 'manual' })
  const cookie = (auth.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  const health = async () => fetch(`${origin}/__a6pri1a/health`, { headers: cookie === '' ? {} : { cookie } })
    .then((r) => r.json()).catch(() => null)

  // The probe does its work inside apply(), i.e. before the boot line; the health route is the readiness channel.
  let report = null
  const probeDeadline = Date.now() + 120_000
  while (Date.now() < probeDeadline) {
    if (existsSync(reportPath)) { report = JSON.parse(readFileSync(reportPath, 'utf8')); break }
    await new Promise((r) => setTimeout(r, 1000))
  }

  const stop = async () => {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 4000))
    let alive = child.exitCode === null && child.signalCode === null
    if (alive) {
      spawn('/bin/bash', ['-c', `pkill -f '${marker}' || true`])
      await new Promise((r) => setTimeout(r, 2000))
      alive = child.exitCode === null && child.signalCode === null
    }
    const free = !(await portInUse(port))
    // The host's own log is read BEFORE the world is deleted — it is evidence, and the world is not.
    const logText = existsSync(logPath) ? readFileSync(logPath, 'utf8') : ''
    return { alive, free, logText }
  }

  // `spawnPid` is the kernel pid of the process THIS driver spawned (`exec -a` replaces bash in place, so
  // the child pid IS the host pid). The reopen leg cross-grades the pid the probe reports about itself
  // against this one — neither end of the instrument can fake the other's identity.
  return { label, port, home, logPath, marker, spawnPid: child.pid, origin, bootUrl, authStatus: auth.status, hasCookie: cookie !== '', health, report, reportPath, stop }
}

async function main() {
  // ── Ports FIRST: every source is validated against TEST_PORT_RANGES before anything can create a world ──
  // Round 2 (F-I1a1-2) replaced "rejects only 3080/3180 and in-use" with band validation: an out-of-band
  // `--port` REFUSES (exit 2, `verdict=port-refused`) naming the sanctioned bands; the default candidate
  // list and the derived restart port are validated the same way; and `bootWorld` re-asserts in-band
  // membership immediately before each spawn. No world directory exists at any refusal point.
  if (PORT_OVERRIDE !== null) {
    const violation = portBandViolation(PORT_OVERRIDE)
    if (violation !== null) {
      log(`DSH-PRI1A-REALHOST verdict=port-refused reason=port-out-of-band requested=${String(argv[argv.indexOf('--port') + 1] ?? '')} detail="${violation}" sanctioned_bands=${BANDS_LABEL} never_bound=3080/3180 — nothing was created, nothing was booted`)
      process.exitCode = 2
      return
    }
  }
  for (const p of PORT_CANDIDATES) {
    const violation = portBandViolation(p)
    if (violation !== null) {
      log(`DSH-PRI1A-REALHOST verdict=port-refused reason=default-candidate-out-of-band candidate=${String(p)} detail="${violation}" sanctioned_bands=${BANDS_LABEL}`)
      process.exitCode = 2
      return
    }
  }

  const runtimeBin = join(RUNTIME, 'apps', 'cli', 'lib', 'bin.js')
  const builtWriter = join(DIST_ROOT, 'runtime', 'review-assignment', 'writer.js')
  const builtDomain = join(DIST_ROOT, 'storage', 'repositories', 'team-domain.js')
  if (!existsSync(runtimeBin)) {
    log(`DSH-PRI1A-REALHOST verdict=env-refused reason=no-materialized-runtime path=${relative(WORKTREE, runtimeBin)} recipe="TEST_METHODS §2: clone --local --no-hardlinks, checkout --detach ${TEST_USE_BASELINE_SHA}, install, build"`)
    process.exitCode = 3
    return
  }
  if (!existsSync(builtWriter) || !existsSync(builtDomain)) {
    log(`DSH-PRI1A-REALHOST verdict=env-refused reason=no-built-artifacts writer=${existsSync(builtWriter)} team-domain=${existsSync(builtDomain)} recipe="pnpm build"`)
    process.exitCode = 3
    return
  }

  const laneHead = gitOut(['rev-parse', 'HEAD'], WORKTREE)
  const hostHead = gitOut(['rev-parse', 'HEAD'], RUNTIME)
  const hostPorcelainBefore = porcelainCount(RUNTIME)
  log(`lane head=${laneHead}; host head=${hostHead} (pin ${TEST_USE_BASELINE_SHA}); host porcelain before=${hostPorcelainBefore}`)
  check('host-is-the-pinned-baseline', hostHead === TEST_USE_BASELINE_SHA && hostPorcelainBefore === 0,
    `host HEAD ${hostHead} vs pin ${TEST_USE_BASELINE_SHA}, porcelain ${hostPorcelainBefore}`)

  // ── The enable surface, asked of the artifact that ships (in-process C1 + a C0 census; NOT a boot leg) ──
  // PR #517 §9.6 hands PR-I1b an obligation phrased as "default-off, and non-enabling teams byte-identical",
  // which pictures a switch a team can be flipped across. Two questions decide whether such a switch exists.
  // (a) The row's config channel is the only input a row gets, and `validateTeamPluginConfig` is the closed gate
  // in front of it: if it accepts an enable key and hands it through unchanged, nothing downstream honours it.
  // (b) Census: does any module in the shipped tree even NAME such a field? Both arms are measurements with
  // their grade named, and neither is offered as a Host pass — the live-host arm of this same question is
  // PR-I1b's instrument, and this kit cites it rather than duplicating it.
  let enableAnswer = 'not measured'
  try {
    const builtRow = await import(new URL(`file://${join(DIST_ROOT, 'runtime', 'src', 'plugin', 'host.js')}`))
    const frozenRowConfig = {
      rootSessionId: ROOT_SESSION, bootPhase: 'create', blueprintSource: 'x', seedMembers: [], generation: 1,
      staticModel: { provider: 'p', model: 'm' }, deniedSelection: null, mcpServers: [], mcpServer: null,
      environmentFacts: [], externalPolicyFacts: { hard: {}, capabilityExists: {} },
      glueUrl: 'file:///x.mjs', seamUrl: 'file:///y.mjs',
    }
    let honoured
    try {
      const returned = builtRow.validateTeamPluginConfig({ ...frozenRowConfig, feature: 'on', assignmentFeature: 'on' })
      honoured = true
      enableAnswer = `validateTeamPluginConfig ACCEPTED the enable keys and handed them through unchanged (feature=${JSON.stringify(returned?.feature)}, assignmentFeature=${JSON.stringify(returned?.assignmentFeature)})`
    } catch (error) {
      honoured = false
      enableAnswer = `validateTeamPluginConfig REFUSED the enable keys: ${String(error?.message).slice(0, 180)}`
    }
    const census = spawnSync('grep', ['-rl', '-E', 'assignmentFeature', '--include=*.ts', '--include=*.mjs',
      join(WORKTREE, 'packages')], { encoding: 'utf8' })
    const hits = (census.stdout ?? '').trim().split('\n').filter((l) => l !== '' && !l.includes('/dist/'))
    // One falsifiable predicate, not one that passes under either answer: an enable surface exists iff the
    // channel carries the key AND something in the shipped tree reads it. Refusing the key, or carrying a key
    // nobody reads, both mean "no switch" — and this leg goes RED the day a reader appears, which is the whole
    // point of measuring it instead of asserting it.
    check('enable-surface-is-not-a-host-switch', !(honoured && hits.length > 0),
      `C1+C0: ${enableAnswer}; and ${String(hits.length)} file(s) under packages/** outside dist name the key${hits.length > 0 ? ` (${hits.slice(0, 4).join(', ')})` : ''} → ${honoured && hits.length > 0 ? 'a reader exists, the A/B IS expressible and the "default-off" wording stands' : 'no path from any host surface to the writer, so no default-off/enabled A/B exists to be graded'}`)
    log(`INFO enable-surface for the record — ${enableAnswer}`)
  } catch (error) {
    refuse('enable-surface-is-not-a-host-switch', `the built row module did not import: ${String(error?.message).slice(0, 160)}`)
  }

  let port = PORT_OVERRIDE
  if (port !== null && await portInUse(port)) {
    log(`requested port ${port} is in use (band membership already validated above); falling back to the candidate list`)
    port = null
  }
  if (port === null) {
    for (const p of PORT_CANDIDATES) {
      if (FORBIDDEN_PORTS.has(p)) continue
      if (!(await portInUse(p))) { port = p; break }
      log(`port ${p} busy, trying next`)
    }
  }
  if (port === null) {
    log('DSH-PRI1A-REALHOST verdict=env-refused reason=no-free-port-in-318x-family')
    process.exitCode = 3
    return
  }
  const restartPort = PORT_CANDIDATES.find((p) => p !== port && !FORBIDDEN_PORTS.has(p)) ?? port
  const restartViolation = portBandViolation(restartPort)
  if (restartViolation !== null || restartPort === port) {
    log(`DSH-PRI1A-REALHOST verdict=port-refused reason=restart-port-unusable restartPort=${String(restartPort)} detail="${restartViolation ?? 'restart port equals the write port'}" sanctioned_bands=${BANDS_LABEL}`)
    process.exitCode = 2
    return
  }
  log(`both worlds' ports in band immediately before any world exists: write=${String(port)} restart=${String(restartPort)} sanctioned_bands=${BANDS_LABEL}`)

  /** What the raw-disk leg found, kept for the capture. */
  let diskEvidence = { scanned: 0, hits: {} }
  const home = join(HOMES, `${RUN_STAMP}-write`)
  if (existsSync(home) && readdirSync(home).length > 0) {
    log(`DSH-PRI1A-REALHOST verdict=env-refused reason=world-not-empty path=${relative(WORKTREE, home)}`)
    process.exitCode = 3
    return
  }
  const report1 = join(home, 'probe-write.json')
  const report2 = join(home, 'probe-restart.json')

  let host1 = null
  let host2 = null
  let boot1Log = ''
  let boot2Log = ''
  let booted = true
  try {
    // ── Boot 1: write the family through the shipped writer, on the host's real medium ──────────────────
    host1 = await bootWorld({ label: 'write', port, mode: 'write', home, reportPath: report1 })
    check('boot-1-reached-the-public-gate', host1.authStatus === 303 && host1.hasCookie,
      `GET /?token= -> ${host1.authStatus}, cookie ${host1.hasCookie ? 'issued' : 'ABSENT'} (token scrubbed)`)
    const r1 = host1.report
    if (r1 === null) {
      booted = false
      refuse('boot-1-wrote-the-family', 'the probe produced no report within 120s; the host log tail is in the evidence')
    } else {
      const step1 = (id) => r1.steps?.find((s) => s.id === id) ?? null
      check('boot-1-probe-completed', r1.state === 'done', `probe state=${r1.state} detail=${String(r1.detail)}`)
      // Round 2 (F-I1a1-1): these three probe steps used to carry the literal `true` and feed no check.
      // They are predicates now (observed seam surface / host-reported domain name / close() outcome),
      // and grading them here is what stops a future constant from hiding in the capture again.
      check('boot-1-real-seam-built', step1('real-seam-built')?.ok === true, String(step1('real-seam-built')?.measured))
      check('boot-1-domain-created-on-real-medium', step1('domain-created-real-medium')?.ok === true, String(step1('domain-created-real-medium')?.measured))
      check('boot-1-domain-closed-clean', step1('domain-closed')?.ok === true, String(step1('domain-closed')?.measured))
      check('boot-1-writer-wrote-created', step1('write-created')?.ok === true, String(step1('write-created')?.measured))
      check('boot-1-replay-answers-already-in-process', step1('replay-same-command')?.ok === true,
        String(step1('replay-same-command')?.measured))
      check('boot-1-writer-wrote-transferred-and-retired',
        step1('write-transferred')?.ok === true && step1('write-retired')?.ok === true,
        `${String(step1('write-transferred')?.measured)} ;; ${String(step1('write-retired')?.measured)}`)
      check('boot-1-generation-advanced-per-write', step1('generation-advanced-per-write')?.ok === true,
        String(step1('generation-advanced-per-write')?.measured))
      check('boot-1-three-rows-in-real-ledger', step1('rows-in-real-ledger')?.ok === true, String(step1('rows-in-real-ledger')?.measured))
      check('boot-1-lock-was-serialised', (r1.lock?.acquires ?? 0) === 4 && (r1.lock?.peak ?? 0) === 1,
        `lock acquires=${String(r1.lock?.acquires)} peak depth=${String(r1.lock?.peak)} (one critical section at a time)`)
      const w = r1.writes ?? {}
      check('boot-1-sequence-chain-is-1-2-3', [w.created?.sequence, w.transferred?.sequence, w.retired?.sequence].join(',') === '1,2,3',
        `sequences created=${String(w.created?.sequence)} transferred=${String(w.transferred?.sequence)} retired=${String(w.retired?.sequence)}`)
    }
    const s1 = await host1.stop()
    boot1Log = s1.logText
    check('boot-1-stopped-and-port-free', !s1.alive && s1.free, `process ${s1.alive ? 'STILL ALIVE' : 'stopped'}, port ${port} ${s1.free ? 'free' : 'STILL BOUND'}`)

    // ── Leg 3: the bytes on disk, read by THIS process after the host is gone ───────────────────────────
    // Only files the HOST wrote count. The probe's own report and the host log both carry the fact-type
    // strings as prose; scanning them would make this leg pass on the probe's own words — a gate that cannot
    // fail. Everything this kit wrote is excluded by name.
    const own = new Set(['probe-write.json', 'probe-restart.json', 'host-write.log', 'host-restart.log'])
    const worldFiles = filesUnder(home).filter((f) => {
      const rel = relative(home, f)
      return !own.has(rel) && !rel.startsWith(join('profiles'))
    })
    const hitFiles = {}
    for (const fact of FACT_TYPES) {
      hitFiles[fact] = []
      for (const f of worldFiles) {
        if (!existsSync(f)) continue
        const text = readFileSync(f).toString('latin1')
        const hits = text.split(fact).length - 1
        if (hits > 0) hitFiles[fact].push({ file: relative(home, f), hits })
      }
    }
    const totalHits = FACT_TYPES.reduce((n, f) => n + hitFiles[f].reduce((m, h) => m + h.hits, 0), 0)
    const missing = FACT_TYPES.filter((f) => hitFiles[f].length === 0)
    const hitList = FACT_TYPES.flatMap((f) => hitFiles[f].map((h) => `${h.file}=${String(h.hits)}`))
    // Round 2 (F-I1a1-6): the leg used to report only counts; the scanned FILE NAMES are now printed and
    // captured, so the reader sees exactly which bytes of the world were graded — no silent dimension left.
    const scannedNames = worldFiles.map((f) => relative(home, f)).sort()
    diskEvidence = { scanned: worldFiles.length, scannedFiles: scannedNames, hits: hitFiles }
    check('durable-bytes-exist-in-world-files', missing.length === 0 && totalHits >= 3,
      `${String(totalHits)} occurrence(s) of the three fact types in host-written files (${hitList.join(', ') || 'none'})${missing.length === 0 ? '' : `; MISSING ${missing.join(', ')}`}; ${String(worldFiles.length)} host file(s) scanned after the host process exited (${scannedNames.join(', ') || 'no files'})`)

    // ── Boot 2: a SECOND process over the SAME world reopens and folds what boot 1 wrote ────────────────
    // The restart probe receives boot 1's recorded identity — the pid THIS driver spawned and the argv0
    // marker it stamped — and its reopen step must assert its own kernel identity differs (F-I1a1-1).
    host2 = await bootWorld({ label: 'restart', port: restartPort, mode: 'restart', home, reportPath: report2,
      previousBoot: { pid: host1.spawnPid, argv0: host1.marker } })
    const r2 = host2.report
    if (r2 === null) {
      refuse('boot-2-reopened-the-medium', 'the restart probe produced no report within 120s')
    } else {
      const step2 = (id) => r2.steps?.find((s) => s.id === id) ?? null
      check('boot-2-probe-completed', r2.state === 'done', `probe state=${r2.state} detail=${String(r2.detail)}`)
      // Round 2 (F-I1a1-1): the probe's step is now a real predicate (different pid + different argv0 than
      // the recorded boot-1 identity), and the driver adds its own cross-grade: each boot's SELF-REPORTED
      // pid/marker must match what the driver SPAWNED, the two pids must differ, and the two module nonces
      // must differ. No argument to this check is a literal.
      const p1 = r1?.process ?? null
      const p2 = r2.process ?? null
      // F-I1a2-1 (round 3): the conjuncts below ARE this leg's predicate — `check` grades `every(ok)`, so the
      // FAIL transcript cannot describe anything other than what was actually evaluated. Each carries its
      // side (in-host probe vs this driver), the file:line of its own bytes, and the values both sides had.
      const reopenConjuncts = [
        conjunct('probe', 'the probe concluded it is not the boot-1 process', step2('domain-reopened-fresh-process')?.ok === true,
          `step.ok=${String(step2('domain-reopened-fresh-process')?.ok)} — ${String(step2('domain-reopened-fresh-process')?.measured)}`,
          ARM_REOPEN_PROBE),
        conjunct('driver', 'both boots reported a process identity', p1 !== null && p2 !== null,
          `boot 1 report ${p1 === null ? 'ABSENT' : 'present'}; boot 2 report ${p2 === null ? 'ABSENT' : 'present'}`),
        conjunct('driver', 'boot-1 self-reported pid equals the pid this driver spawned', p1?.pid === host1.spawnPid,
          `reported=${String(p1?.pid)} spawned=${String(host1.spawnPid)}`),
        conjunct('driver', 'boot-1 self-reported argv0 equals the marker this driver stamped', p1?.argv0 === host1.marker,
          `reported=${String(p1?.argv0)} stamped=${host1.marker}`),
        conjunct('driver', 'boot-2 self-reported pid equals the pid this driver spawned', p2?.pid === host2.spawnPid,
          `reported=${String(p2?.pid)} spawned=${String(host2.spawnPid)}`),
        conjunct('driver', 'boot-2 self-reported argv0 equals the marker this driver stamped', p2?.argv0 === host2.marker,
          `reported=${String(p2?.argv0)} stamped=${host2.marker}`),
        conjunct('driver', 'the two pids this driver spawned differ', host1.spawnPid !== host2.spawnPid,
          `spawned boot 1=${String(host1.spawnPid)} boot 2=${String(host2.spawnPid)}`),
        conjunct('driver', 'the two self-reported pids differ', p1?.pid !== p2?.pid,
          `reported boot 1=${String(p1?.pid)} boot 2=${String(p2?.pid)}`),
        conjunct('driver', 'the two module nonces differ', p1?.nonce !== p2?.nonce,
          `nonce boot 1=${String(p1?.nonce)} boot 2=${String(p2?.nonce)}`),
      ]
      check('boot-2-reopened-in-a-fresh-process', reopenConjuncts.every((c) => c.ok),
        `boot 1: pid ${String(p1?.pid)} argv0 ${String(p1?.argv0)} (driver spawned pid ${String(host1.spawnPid)} marker ${host1.marker}); ` +
        `boot 2: pid ${String(p2?.pid)} argv0 ${String(p2?.argv0)} (driver spawned pid ${String(host2.spawnPid)} marker ${host2.marker}); ` +
        `pids differ: ${String(p1?.pid !== p2?.pid)}, nonces differ: ${String(p1?.nonce !== p2?.nonce)}; ${String(step2('domain-reopened-fresh-process')?.measured)}`,
        reopenConjuncts)
      check('boot-2-rows-survived-the-restart', step2('rows-survived-restart')?.ok === true, String(step2('rows-survived-restart')?.measured))
      // F-I1a1-3 + F-I1a2-2: the comparison is FULL-row JSON equality; the FAIL line keeps its 400-char
      // truncation and adds the FIRST DIFFERING ROW INDEX and FIELD PATH, so a payload difference in the
      // third row is locatable without unrolling the transcript.
      const boot1Rows = r1?.rows ?? null
      const boot2Rows = (r2.rows ?? []).slice(0, 3)
      const same = JSON.stringify(boot1Rows) === JSON.stringify(boot2Rows)
      // Only the DRIVER quotes its own arm by its own label, because that label sits on the same line as the
      // arm. A quote whose anchor is written literally on a DIFFERENT line matches both lines, so cross-file
      // quotes (the probe) are the only ones carrying an explicit anchor here — `--self-test` enforces both.
      // Since round 3 those anchors sit ON the arm line (F-I1a3-1): the two handoff arms below are the probe's
      // own `rows` lines, resolved from the probe bytes at grade time, not offsets under the `emit(` anchor.
      const rowsConjuncts = [
        conjunct('driver', 'boot 1 produced a report whose rows can be compared at all', r1 !== null,
          `boot 1 reported ${String(boot1Rows?.length ?? 0)} row(s), boot 2 reported ${String(boot2Rows.length)} row(s); the two handoff lines quoted below are the only sources of these two arrays`,
          [ARM_BOOT1_HANDOFF, ARM_BOOT2_HANDOFF]),
        conjunct('driver', 'every field of every row is byte-identical across the two boots', same,
          same ? 'FULL-row JSON equality holds'
            : `${firstRowDifference(boot1Rows, boot2Rows)}; boot1=${JSON.stringify(boot1Rows).slice(0, 400)} boot2=${JSON.stringify(boot2Rows).slice(0, 400)}`),
      ]
      check('boot-2-rows-are-boot-1-rows', rowsConjuncts.every((c) => c.ok),
        same ? 'the three FULL rows (schemaVersion, sequence, rootSessionId, factType, PAYLOAD, createdAt — every field `list()` hands back) read in the fresh process are byte-identical to the three boot 1 wrote; payload identity is ALSO enforced transitively: a payload the shipped fold cannot reconcile answers REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED (packages/runtime/review-assignment/writer.ts, the fold-unreconciled refusal) instead of replaying'
          : `${firstRowDifference(boot1Rows, boot2Rows)}; boot1=${JSON.stringify(boot1Rows).slice(0, 400)} boot2=${JSON.stringify(boot2Rows).slice(0, 400)}`,
        rowsConjuncts)
      check('boot-2-generation-is-durable', step2('generation-durable')?.ok === true
        && r2.generation === r1?.generation?.after,
        `generation ${String(r2.generation)} in the fresh process vs ${String(r1?.generation?.after)} at the end of boot 1`)
      check('boot-2-replay-after-restart-answers-already-at-original-sequence', step2('replay-after-restart-answers-already')?.ok === true
        && r2.replayFirst?.sequence === r1?.writes?.created?.sequence,
        `${String(step2('replay-after-restart-answers-already')?.measured)}; original sequence ${String(r1?.writes?.created?.sequence)}`)
      check('boot-2-replay-wrote-nothing', step2('replay-wrote-nothing')?.ok === true, String(step2('replay-wrote-nothing')?.measured))
      // Round 2 (F-I1a1-7): `> previousMax` passed a jump to 9. The expected sequence is exact now, on
      // both sides: the probe asserts `sequence === previousMax + 1` and the driver re-derives the
      // previous max from BOOT 1's rows, so a fresh row that skips a value reddens this leg.
      const r1Max = (r1?.rows ?? []).reduce((m, row) => (typeof row.sequence === 'number' && row.sequence > m ? row.sequence : m), 0)
      // F-I1a2-1 (round 3): two arms, printed as such on FAIL. The probe's arm is its OWN predicate at its own
      // file:line (quoted below, which is where a mutated expected/predicate shows its bytes); the driver's
      // arm re-derives the expected value from boot 1's rows independently. When the values are self-
      // consistent but the leg is red, the quoted predicate line is the only remaining explanation — which is
      // precisely the case round 2 could not see.
      const continueConjuncts = [
        conjunct('probe', 'the probe asserted its own fresh write continued the chain exactly', step2('new-family-writes-after-restart')?.ok === true,
          `step.ok=${String(step2('new-family-writes-after-restart')?.ok)} — ${String(step2('new-family-writes-after-restart')?.measured)}`,
          ARM_NEW_FAMILY_STEP),
        conjunct('driver', 'the driver re-derives the same expected sequence from boot 1 rows', r2.fresh?.sequence === r1Max + 1,
          `boot 1 rows carry max sequence ${String(r1Max)}, so the next write must be ${String(r1Max + 1)}; boot 2 reported sequence ${String(r2.fresh?.sequence)}`),
      ]
      check('boot-2-new-family-continues-the-chain', continueConjuncts.every((c) => c.ok),
        `${String(step2('new-family-writes-after-restart')?.measured)}; driver-side expected exactly ${String(r1Max)} + 1 = ${String(r1Max + 1)} (not merely "> ${String(r1Max)}")`,
        continueConjuncts)
    }
    const s2 = await host2.stop()
    boot2Log = s2.logText
    check('boot-2-stopped-and-port-free', !s2.alive && s2.free,
      `process ${s2.alive ? 'STILL ALIVE' : 'stopped'}, port ${restartPort} ${s2.free ? 'free' : 'STILL BOUND'}`)
  } catch (error) {
    booted = false
    check('instrument-completed', false, `${error?.name ?? 'Error'}: ${scrub(error?.message ?? String(error))}`)
  } finally {
    for (const host of [host1, host2]) {
      if (host === null) continue
      try {
        const s = await host.stop()
        if (s.alive) log(`${host.label}: teardown left the process alive; marker ${host.marker} must be killed by hand`)
      } catch { /* already stopped */ }
    }
    const survivors = [host1, host2].filter((h) => h !== null).map((h) => h.port)
    for (const p of [...new Set([...survivors, port, restartPort])]) {
      const bound = await portInUse(p)
      log(`port-check ${p} ${bound ? 'BOUND' : 'free'}`)
    }
    if (!KEEP_WORLD) {
      rmSync(home, { recursive: true, force: true })
      const left = existsSync(HOMES) ? readdirSync(HOMES).filter((n) => !n.startsWith('.')) : []
      check('worlds-torn-down', left.length === 0, left.length === 0 ? 'tests/homes/ is empty again' : `left behind: ${left.join(', ')}`)
    } else {
      log(`--keep-world: world left at ${relative(WORKTREE, home)}`)
    }
    const hostPorcelainAfter = porcelainCount(RUNTIME)
    check('host-tree-stayed-pristine', hostPorcelainAfter === 0, `host porcelain after=${hostPorcelainAfter}`)
  }

  const failed = results.filter((r) => r.verdict === 'FAIL')
  const refused = results.filter((r) => r.verdict === 'REFUSED')
  const passed = results.filter((r) => r.verdict === 'PASS')
  const verdict = failed.length > 0 ? 'fail' : refused.length > 0 ? 'refused' : booted ? 'pass' : 'refused'

  const verdictLine = `DSH-PRI1A-REALHOST verdict=${verdict} pass=${String(passed.length)} fail=${String(failed.length)} refused=${String(refused.length)} legs=${String(results.length)}` +
    (failed.length > 0 ? ` failed=${failed.map((r) => r.id).join(',')}` : '') +
    (refused.length > 0 ? ` refusedlegs=${refused.map((r) => r.id).join(',')}` : '')
  // The verdict line goes into the transcript BEFORE the transcript is written, so a stamped directory carries
  // its own grade: an evidence file that only lists PASS/FAIL rows and never states the run's verdict leaves the
  // reader to recompute it, and a recomputed verdict is an assertion again.
  log(verdictLine)

  const stampDir = join(EVIDENCE_ROOT, RUN_STAMP)
  mkdirSync(stampDir, { recursive: true })
  writeFileSync(join(stampDir, 'MEASURED-LINES.txt'), lines.map(scrub).join('\n') + '\n')
  writeFileSync(join(stampDir, 'capture.json'), JSON.stringify({
    runStamp: RUN_STAMP, laneHead, hostHead, hostPorcelainBefore, hostPorcelainAfter: porcelainCount(RUNTIME),
    runtime: { baseline: TEST_USE_BASELINE_SHA, clientCommitHash: CLIENT_COMMIT_HASH },
    ports: { write: port, restart: restartPort, sanctionedBands: BANDS_LABEL },
    spawnPids: { write: host1?.spawnPid ?? null, restart: host2?.spawnPid ?? null },
    world: relative(WORKTREE, home), keepWorld: KEEP_WORLD,
    rootSessionId: ROOT_SESSION, approvalCaseId: CASE_ID,
    disk: diskEvidence, enableSurface: enableAnswer,
    checks: results,
    probe: { write: host1?.report ?? null, restart: host2?.report ?? null },
  }, null, 2).replace(/([?&]token=)[^&#\s"']*/g, '$1<REDACTED>') + '\n')
  // The host's own logs are read inside stop(), BEFORE the world is deleted; the world is disposable, the
  // transcript of what the host said while it was alive is the evidence.
  if (boot1Log !== '') writeFileSync(join(stampDir, 'host-write.log'), scrub(boot1Log))
  if (boot2Log !== '') writeFileSync(join(stampDir, 'host-restart.log'), scrub(boot2Log))
  log(`evidence: ${relative(WORKTREE, stampDir)} (the verdict line above is inside MEASURED-LINES.txt)`)
  process.exitCode = verdict === 'pass' ? 0 : 1
}

if (SELF_TEST) {
  // No world, no port, no host: this path grades the instrument's own FAIL rendering and nothing else.
  process.exitCode = selfTest()
} else {
  main().catch((error) => {
    log(`DSH-PRI1A-REALHOST verdict=crash ${scrub(error?.stack ?? String(error))}`)
    process.exitCode = 1
  })
}