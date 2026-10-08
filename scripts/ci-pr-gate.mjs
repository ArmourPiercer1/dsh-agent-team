#!/usr/bin/env node
/**
 * ci-pr-gate.mjs — the A4-PR7 §7.6 merge gate as ONE command, with ONE verdict token.
 *
 * WHY THIS FILE EXISTS. `.github/workflows/` held only `characterization.yml`, and that one
 * triggers on `workflow_dispatch` only: since 2026-09-17 nothing in this repository has run
 * automatically. Every gate leg Alpha.4 built — typecheck, the lint identity diff, artifact
 * freshness, the blueprint fence, the nine-root census, the `graph.yaml` parse — was a command
 * in a plan document that executed if the coordinating agent remembered to execute it. Three
 * measured consequences of that, all in this repository's own history:
 *
 *   1. a test branch carrying 27 TypeScript errors was "ready to merge" because `pnpm build`
 *      and `vitest` do not typecheck;
 *   2. an unparsable `dev/agent-workflow/graph.yaml` reached `master` TWICE, the second time
 *      through a merged PR (#195), because the parse assertion ran in a different shell
 *      statement from the commit and a shell does not carry a failure across a newline;
 *   3. `dev/agent-workflow/hooks/pre-commit` enforces that same parse only on machines where
 *      someone copied it into `.git/hooks/` — on the server it enforces nothing.
 *
 * So this file has two jobs. It makes the gate runnable as one command, and — more important —
 * it makes the gate's ANSWER machine-readable, so "did the gate run?" is never again a question
 * about somebody's discipline. `.github/workflows/pr-gate.yml` calls this same file with
 * `--full`; there is no second list of checks to drift.
 *
 * ── THE VERDICT CHANNEL ────────────────────────────────────────────────────────────────────
 *
 *   DSH-CI-LEG leg=<name> verdict=<pass|fail|skip|refused> seconds=<n> detail=<one line>
 *   DSH-CI-VERDICT <pass|fail> pass=<n> fail=<n> skip=<n> skipped=<comma-list|none> legs=<n>
 *                     refused=<n> refusedlegs=<comma-list|none>
 *
 * `skip` and `refused` say different things and the channel keeps them apart. A `skip` is a
 * choice made before the run (`--skip`, or the census being opt-in by default). A `refused` is
 * the instrument discovering that THIS checkout cannot be graded at all, and it must name the
 * missing prerequisite. The word exists because of a measured harm: on a GitHub-hosted runner
 * (run 37794562230) the census ran 57 legs that resolve the gitignored pristine host checkout,
 * every one failed for want of it, and the gate reported 57 NEW REDS against a tree that was
 * fine. A red that blames the product for the runner is worse than no red: it trains the reader
 * to ignore reds. So the census now refuses before spawning vitest, and a refusal is legal only
 * when the invocation declared it (`--allow-refused <leg>`) — the re-grader re-checks the token
 * against the leg lines, so a refusal cannot be silent in either direction.
 *
 * Two rules, both load-bearing, both pinned by `--self-test` and demonstrated by a transcript:
 *
 *   - **A missing `DSH-CI-VERDICT` line means `fail`, never `not-run`.** A run that died, was
 *     killed, or crashed mid-leg produces no token, and "we don't know" graded as acceptable is
 *     exactly how `check-artifacts-committed.mjs` once printed `OK … match the fresh build` over
 *     a surface no build had produced in days. Check a transcript with
 *     `node scripts/ci-pr-gate.mjs --check-transcript <file>`.
 *   - **A skip is named, never silent.** The default run skips the (expensive) census and prints
 *     `verdict=skip` for it with the reason and the flag that enables it. Under `--full` — which
 *     is what CI runs — any skip is a failure, so CI can never be green because a leg abstained.
 *     This is the `pnpm smoke:composition` lesson from §7.5: it exited 0 while its client leg
 *     printed a named SKIP, and the plan amendment there forbids asserting that exit code.
 *
 * ── WHAT THE LEGS MEASURE, AND WHAT THEY MAY NEVER MEASURE ─────────────────────────────────
 *
 * `pnpm lint` is red at `master` by ruling (128 errors / 32 warnings concentrated in test code,
 * §7.6 and the Baseline Verification Discipline). So the lint leg treats the **identity diff**
 * against `dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` as the
 * authority and the exit code as evidence only. The same discipline governs the census: the
 * root suite has 22 disclosed failing identities, so its exit code says nothing and the
 * **identity set** against `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md`
 * is the verdict. Neither leg may "fix" a standing condition: this script never writes a
 * baseline, and a lane that wants one re-recorded has to do it in the open (the coordinator
 * duty in the plan's Baseline Verification Discipline), not from inside a gate.
 *
 * The census leg compares identity SETS and never counts, because the baseline file says so in
 * its own words ("Compare IDENTITY SETS, never totals, and always name your roots") and because
 * its totals have moved three times (500/6262 → 502/6277 → 505/6288) while the 22-identity
 * failing set did not. Counts are printed as context, and two count-derived things are treated
 * as verdicts:
 *
 *   - **ESCALATION**: a titled red that disappears while its file starts reporting a collection
 *     error. That is a leg that stopped being measurable, not a leg that got fixed, and it is
 *     `fail` even though the red count went down.
 *   - a **disclosed load family** — and which families exist is read out of the baseline
 *     document's prose by `parseLoadFamilies`, never out of this file. A new red inside one is
 *     dismissed only by the re-sampling the baseline demands (at least three re-samples, rate
 *     published on the leg line), and a red that survives them is `fail`. The first draft of this
 *     script hardcoded `p6t1-parallel.test.ts` instead, which is the author keeping an exemption
 *     list; the same hour it was measured, a `--full` run went red on a DIFFERENT load-sensitive
 *     leg — `a3p3-governance-lane-hygiene.test.ts`, which normally takes 4.1–4.6 s against
 *     vitest's default 5000 ms and took 6.9 s on one capture of four, failing as
 *     `Error: Test timed out in 5000ms` — and the hardcoded version had no way to know it. That
 *     red stayed red, which is the correct outcome: an undisclosed family buys nothing, and its
 *     owner either discloses it in the baseline or fixes the leg. If a future baseline stops
 *     naming a family, that family stops being excused; a gate cannot inherit an excuse its own
 *     reference withdrew.
 *
 * Exit code mirrors the token: 0 pass, 1 fail. Nothing else is exit 0.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The only three reference documents this gate reads. Named here so a retarget is a diff. */
const BASELINES = {
  lint: 'dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt',
  census: 'dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md',
  fence: 'dev/agent-workflow/evidence/a4-pr7/ci-gate/blueprint-fence-baseline-606a0be7.txt',
}

const GRAPH_YAML = 'dev/agent-workflow/graph.yaml'

/**
 * Order is normative and it is cheap-first: a tree with a broken `graph.yaml` or a broken
 * typecheck must not pay five minutes of scratch builds to find out.
 */
const LEG_ORDER = [
  'graph-parse',
  'state-freshness',
  'install',
  'blueprint-fence',
  'typecheck',
  'lint-identities',
  'artifacts-at-head',
  'census',
]

/**
 * The one leg that is opt-in by default, with the reason a reader can check. The brief that
 * commissioned this file said the census costs ~9 minutes; measured on this machine it is the
 * root `vitest run` at 97–105 s wall (`dev/agent-workflow/evidence/a4-pr7/ci-gate/`), which is
 * why CI runs it under `--full` anyway. It stays behind a flag locally because it is still the
 * heaviest leg here and because a coordinator mid-merge wants a sub-minute default.
 */
const OPTIONAL_BY_DEFAULT = new Set(['census'])

// ─────────────────────────────────────────────────────────────────────────── run + verdict ──

/** Emit one leg line. `detail` is flattened: a verdict channel nobody can grep is decoration. */
function legLine(fields) {
  const flat = (v) => String(v).replace(/\s+/g, ' ').trim().slice(0, 400)
  return `DSH-CI-LEG ${Object.entries(fields).map(([k, v]) => `${k}=${flat(v)}`).join(' ')}`
}

export function finalToken(verdict, counts) {
  return (
    `DSH-CI-VERDICT ${verdict} pass=${String(counts.pass)} fail=${String(counts.fail)} ` +
    `skip=${String(counts.skip)} skipped=${counts.skipped.length > 0 ? counts.skipped.join(',') : 'none'} ` +
    `legs=${String(counts.legs)} ` +
    `refused=${String(counts.refused ?? 0)} ` +
    `refusedlegs=${(counts.refusedList ?? []).length > 0 ? counts.refusedList.join(',') : 'none'}`
  )
}

/**
 * A leg may end `refused` only if the invocation declared that leg. Anything else becomes a
 * fail that states how to make it legal, because an undeclared `cannot measure here` is
 * indistinguishable at 3 a.m. from a silent skip. Pure by design: the policy is the part worth
 * pinning, and it must be drivable without a checkout.
 */
/**
 * A `#` line between two backslash-continued command lines is not a comment: bash joins the escaped
 * newline first, so the `#` opens a comment that eats the rest of the logical line — every flag
 * after it and usually the rest of the pipeline. The runner still echoes the whole script in its log,
 * so the run LOOKS like it passed those flags; measured on run 37801019804, which cost a hosted run
 * and the transcripts nobody could download. Returns 1-based line numbers of offending comments.
 */
/**
 * The recovery pointer, graded instead of trusted. Round 44's review found `current_phase` asserting
 * `master = 606a0be7 (PR #65-#196 all merged)` four rounds after that stopped being true, with nothing
 * failing — because a revision embedded in prose has no grammar to violate. This is that grammar. It
 * reads the fields by a stated shape rather than a YAML library on purpose, and FAILS CLOSED when a
 * field is absent, so reformatting the document cannot quietly turn the check vacuous.
 *
 * Round records may be written as `s7_roundNN_records` or, when one record covers two rounds, as
 * `s7_roundNN_MM_records` (the file really contains `s7_round19_20_records`). Both spellings fill the
 * rounds they name; a hole in the result is a dropped record, which looks exactly like a skipped one.
 *
 * @param graphText - raw dev/agent-workflow/graph.yaml.
 * @param logText - raw dev/agent-workflow/SESSION_ROUTER_LOG.md.
 * @param isAncestor - (sha) => boolean, whether that revision is reachable from HEAD.
 */
export function checkStatePointers({ graphText, logText, isAncestor }) {
  const findings = []
  const info = {}
  const g = String(graphText)
  const phase = /^current_phase:\s*(.*)$/m.exec(g)
  if (!phase) findings.push('current_phase is absent; recovery state cannot be missing and green')
  else {
    // The rule that keeps this fix from rotting: the field naming the phase may not name a revision.
    // Anything mutable belongs in state_pointers, where it is graded.
    if (/\bmaster\s*=\s*[0-9a-f]{7,40}/i.test(phase[1])) {
      findings.push('current_phase embeds a master revision; that claim goes stale silently — move it to state_pointers.master_sha')
    }
    if (/\bPR\s+#\d+/.test(phase[1])) {
      findings.push('current_phase enumerates PR numbers; a PR census in prose is stale the moment a PR merges — state_pointers only')
    }
  }
  const hasSp = /^state_pointers:\s*$/m.test(g)
  if (!hasSp) findings.push('state_pointers block is absent (added round 44); recovery would be reading prose again')
  const roundM = hasSp ? /^ {2}round:\s*(\d+)\s*$/m.exec(g) : null
  const shaM = hasSp ? /^ {2}master_sha:\s*([0-9a-f]{7,40})\s*$/m.exec(g) : null
  if (!roundM) findings.push('state_pointers.round missing or not an integer at the pinned indentation')
  if (!shaM) findings.push('state_pointers.master_sha missing or not a 7-40 hex revision at the pinned indentation')

  const rounds = new Set()
  for (const m of g.matchAll(/s7_round(\d+)(?:_(\d+))?_records/g)) {
    const a = Number(m[1])
    const b = m[2] === undefined ? a : Number(m[2])
    for (let r = Math.min(a, b); r <= Math.max(a, b); r += 1) rounds.add(r)
  }
  const uniq = [...rounds].sort((x, y) => x - y)
  if (uniq.length === 0) findings.push('no s7_roundNN_records node found; the graph holds no round records')
  const newest = uniq.length > 0 ? uniq[uniq.length - 1] : -1
  const gaps = []
  for (let k = 1; k < uniq.length; k += 1) for (let r = uniq[k - 1] + 1; r < uniq[k]; r += 1) gaps.push(r)
  if (gaps.length > 0) findings.push(`round records have gaps at ${gaps.join(',')}; a missing number is a dropped record, not a skipped one`)

  const logRounds = [...String(logText).matchAll(/^## \d{4}-\d{2}-\d{2} round (\d+)/gm)].map((m) => Number(m[1]))
  const lastLog = logRounds.length > 0 ? logRounds[logRounds.length - 1] : -1
  info.graph_newest_round = newest
  info.log_last_round = lastLog
  if (roundM) {
    const declared = Number(roundM[1])
    info.declared_round = declared
    if (newest >= 0 && declared !== newest) findings.push(`state_pointers.round ${declared} disagrees with newest round record (s7_round${newest}_records)`)
    if (lastLog >= 0 && declared !== lastLog) {
      findings.push(`state_pointers.round ${declared} disagrees with last SESSION_ROUTER_LOG heading "round ${lastLog}" (log and graph were not updated in the same round)`)
    }
  } else if (newest >= 0) findings.push(`cannot check the pointer: newest record is s7_round${newest}_records and round is unparseable`)
  if (shaM) {
    const sha = shaM[1]
    info.declared_sha = sha
    if (!isAncestor(sha)) findings.push(`state_pointers.master_sha ${sha} is not reachable from HEAD: the pointer names a revision this tree cannot produce`)
  }
  return { findings, info }
}

export function findContinuationComments(script) {
  const lines = String(script).split('\n')
  const bad = []
  for (let i = 1; i < lines.length; i += 1) {
    if (!/\\\s*$/.test(lines[i - 1] ?? '')) continue
    if (/^\s*#/.test(lines[i])) bad.push(i + 1)
  }
  return bad
}

export function applyRefusalPolicy(name, result, allowRefused) {
  if (result.verdict !== 'refused') return result
  if (Array.isArray(allowRefused) && allowRefused.includes(name)) return result
  return {
    ...result,
    verdict: 'fail',
    detail:
      `(undeclared refusal — the instrument could not grade this checkout; if that is intended, ` +
      `declare it: --allow-refused ${name}) ${String(result.detail)}`,
  }
}

function runCommand(command, args, opts = {}) {
  const started = Date.now()
  const r = spawnSync(command, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    env: opts.env ?? process.env,
    input: opts.input,
    maxBuffer: 256 * 1024 * 1024,
  })
  return {
    command,
    args,
    seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
    code: r.status,
    signal: r.signal,
    error: r.error ? String(r.error.message ?? r.error) : null,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  }
}

/** Tail for the console; the full capture goes to the transcript file when one is requested. */
function tail(text, n = 12) {
  const lines = String(text).split('\n').filter((l) => l.trim().length > 0)
  return lines.slice(Math.max(0, lines.length - n)).join(' | ')
}

// ──────────────────────────────────────────────────────────────────────────── baselines ──────

/** Read a `#`-commentable, one-identity-per-line baseline file. */
function readLineBaseline(path) {
  const abs = resolve(REPO_ROOT, path)
  if (!existsSync(abs)) throw new Error(`baseline file missing: ${path}`)
  return readFileSync(abs, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0 && !l.startsWith('#'))
    .sort()
}

/**
 * Parse the published nine-root baseline (`…/population-baseline/nine-root-2162f6a7.md`) into
 * `scripts/fail-set.mjs` identity grammar. It parses the COMMITTED document rather than reading
 * a second machine copy because a second copy is a second source of truth, and this file's own
 * subject is what happens to gates whose sources of truth drift.
 *
 * The document's shape (verified against it, and against the closure lane's derived
 * `baseline-2162f6a7.ids.txt`, which this parser reproduces byte-for-byte):
 *   `## titled reds (file > full name), sorted:` then one `<file> > <full name>` per line,
 *   `## collection-error files …:` then one `<file>` per line.
 * An empty parse is a REFUSAL, never a clean baseline: a parser that silently returns the empty
 * set would turn a renamed section heading into "nothing is failing, merge it".
 */
/**
 * Which load families does the baseline document itself name?
 *
 * Tolerance has to come from the document, not from this script: an exemption list maintained by
 * the gate's author is the thing the gate is arguing against (see the header), and it went wrong
 * in the first hour here — the first draft named only `p6t1-parallel.test.ts` and a full run then
 * went red on a second load-sensitive leg the document never mentions.
 *
 * The prose is everything OUTSIDE the two identity sections. That distinction carries weight: an
 * identity listed in the debt section is disclosed DEBT, not an excusable family, so reading the
 * identity list as a family list would excuse every baseline red at once.
 */
export function parseLoadFamilies(md) {
  const families = new Set()
  let section = null
  for (const raw of String(md).split('\n')) {
    const line = raw.trim()
    if (/^##\s+titled reds/.test(line) || /^##\s+collection-error files/.test(line)) {
      section = 'identity'
      continue
    }
    if (/^##\s/.test(line)) section = null
    if (section === 'identity') continue
    // `packages/runtime/test/x.test.ts` written out, or the short form the baseline actually uses
    // ("the p6t1-parallel family"), which is matched as a stem and then substring-matched against
    // ids — so a family moves file and still stays disclosed.
    for (const m of line.matchAll(/(?:packages|dev|tests)\/[^\s`'(),]+\.test\.ts/g)) families.add(m[0])
    for (const m of line.matchAll(/\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\s+(?:load\s+)?(?:flake\s+)?family\b/gi)) families.add(m[1])
  }
  return [...families].sort()
}

export function parsePopulationBaseline(md) {
  const lines = md.split('\n').map((l) => l.replace(/\r$/, ''))
  const titled = []
  const collection = []
  let section = null
  let sawTitledHeader = false
  let sawCollectionHeader = false
  for (const raw of lines) {
    const line = raw.trim()
    if (/^##\s+titled reds/.test(line)) {
      section = 'titled'
      sawTitledHeader = true
      continue
    }
    if (/^##\s+collection-error files/.test(line)) {
      section = 'collection'
      sawCollectionHeader = true
      continue
    }
    // Any OTHER level-2 heading closes the identity sections. Without this the baseline's own
    // `## PUBLISHED CORRECTION (…)` prose would be read as identity lines: that document ends
    // with three paragraphs about a load flake, and a parser that kept consuming would throw on
    // them (right answer, wrong reason) the moment someone writes a path-shaped word there.
    if (/^##\s/.test(line)) {
      section = null
      continue
    }
    // A single `#` line is a comment INSIDE a section (the baseline annotates its own totals
    // that way), so it must not end the section.
    if (line.startsWith('#')) continue
    if (line === '') continue
    if (section === 'titled') {
      const cut = line.indexOf(' > ')
      const file = cut > 0 ? line.slice(0, cut) : ''
      const name = cut > 0 ? line.slice(cut + 3) : ''
      // A malformed line must not be skipped quietly: skipping it is how an identity escapes
      // the baseline and reappears as a NEW red on someone else's run.
      if (!file.includes('/') || !file.endsWith('.test.ts') || name === '') {
        throw new Error(`population baseline: unparseable titled-red line: ${line}`)
      }
      titled.push(`TEST ${file}::${name}`)
    }
    else if (section === 'collection') {
      if (!line.includes('/') || !line.endsWith('.test.ts')) {
        throw new Error(`population baseline: unparseable collection-error line: ${line}`)
      }
      collection.push(`FILE ${line}::COLLECTION-OR-UNHANDLED`)
    }
  }
  // Emptiness is the ABSENCE OF IDENTITY SECTIONS, or of every identity -- it is NOT "one of the
  // two kinds happens to be empty". This read `titled.length === 0 || collection.length === 0`, so a
  // tree that had REPAIRED every collection-error file could not be expressed: reality moved past the
  // guard's state space and the guard fired on good news (measured 2026-10-08, right after PR #205
  // closed the last three, when the restated baseline parsed 10 titled / 0 collection and REFUSED).
  // A guard that cannot say "there is nothing of kind B left" is no safer than no guard at all -- it
  // only trains people to distrust a RED. The hazard this guard was written against (a renamed
  // section heading silently reading as an empty debt list) is refused explicitly below.
  if (!sawTitledHeader || !sawCollectionHeader) {
    throw new Error(
      `population baseline: identity sections not found (titled-reds header ` +
        `${sawTitledHeader ? 'seen' : 'MISSING'}, collection-error header ` +
        `${sawCollectionHeader ? 'seen' : 'MISSING'}) — a renamed heading would otherwise be read as ` +
        `an empty debt list and merged`,
    )
  }
  if (titled.length === 0 && collection.length === 0) {
    throw new Error(
      `population baseline: parsed 0 titled reds and 0 collection files — a baseline with no ` +
        `identity at all is a changed document shape, not an empty debt list, and this leg refuses ` +
        `rather than pass`,
    )
  }
  return {
    ids: [...new Set([...titled, ...collection])].sort(),
    titledCount: new Set(titled).size,
    collectionCount: new Set(collection).size,
    // The tolerance's authority is the document's own prose (see the header). No prose, no excuse.
    loadFamilies: parseLoadFamilies(md),
    flakyFamilyDisclosed: parseLoadFamilies(md).length > 0,
    // The document states its totals three times as it moved (500/6262 in the header, 502/6277
    // re-confirmed, 505/6285 after PR #191). The LAST one in document order is the current
    // disclosure, and it is CONTEXT ONLY: the totals it names are the ones the corpus had, and a
    // census whose file/leg counts differ from it is not a different result. Parsed so the leg
    // can SAY "counts moved, set did not" instead of a reader having to notice it.
    declaredTotals: lastDeclaredTotals(md),
  }
}

/** `502 files / 6277 legs`, `505 files / 6285 legs`, `files 500 | registered legs 6262`. */
function lastDeclaredTotals(md) {
  const patterns = [
    /(\d+)\s+files?\s*\/\s*(\d+)\s+(?:registered\s+)?legs?/g,
    /files\s+(\d+)\s*\|\s*registered legs\s+(\d+)/g,
  ]
  // Highest character offset across BOTH shapes, not "the last match of the last pattern": the
  // document states its oldest total (500/6262) on its third line and its newest (505/6285) in
  // its closing paragraph, and the two use different spellings. Picking by pattern order returns
  // the oldest figure and then reports the newest corpus as if it had moved.
  let found = null
  for (const re of patterns) {
    for (const m of md.matchAll(re)) {
      const at = m.index ?? 0
      if (found === null || at > found.at) found = { files: Number(m[1]), legs: Number(m[2]), at }
    }
  }
  return found === null ? null : { files: found.files, legs: found.legs }
}

// ─────────────────────────────────────────────────────────────────── census comparison (pure) ──

/**
 * Compare a captured census against the published baseline. Pure: it takes identity arrays, so
 * `--self-test` and a re-grade of a stored vitest JSON (`--census-json`) reach the same code a
 * live run does. Returns classes, not a boolean, because the classes are what a reader needs:
 * `NEW` and `ESCALATION` are different sentences even though both are `fail`.
 */
export function compareCensus(baselineIds, currentIds, totals = {}) {
  const baseline = [...new Set(baselineIds)].sort()
  const current = [...new Set(currentIds)].sort()
  const baseSet = new Set(baseline)
  const curSet = new Set(current)
  const added = current.filter((id) => !baseSet.has(id))
  const resolved = baseline.filter((id) => !curSet.has(id))

  // ESCALATION: for a file whose titled reds all vanished, a new collection-error identity on
  // that same file means the leg stopped being reported at all. The baseline says it directly:
  // "a red that resolves into one of these is an ESCALATION, not a fix".
  const filesOf = (ids) => {
    const m = new Map()
    for (const id of ids) {
      const file = id.split('::')[0].replace(/^(TEST|FILE)\s+/, '')
      if (!m.has(file)) m.set(file, [])
      m.get(file).push(id)
    }
    return m
  }
  const baseByFile = filesOf(baseline)
  const escalations = []
  for (const id of added) {
    if (!id.startsWith('FILE ')) continue
    const file = id.split('::')[0].slice('FILE '.length)
    const baseTitled = (baseByFile.get(file) ?? []).filter((x) => x.startsWith('TEST '))
    const stillTitled = baseTitled.filter((x) => curSet.has(x))
    if (baseTitled.length > 0 && stillTitled.length === 0) {
      escalations.push(`${file}: ${String(baseTitled.length)} titled red(s) vanished and the file ` +
        `now reports a collection error — a leg that disappeared into an uncollectable file is an ` +
        `escalation, not a decrease`)
    }
  }
  const newReds = added.filter((id) => id.startsWith('TEST '))
  const newCollections = added.filter(
    (id) => id.startsWith('FILE ') && !escalations.some((e) => id.includes(e.split(':')[0])),
  )
  const setIdentical = added.length === 0 && resolved.length === 0
  const countsMoved = totals.moved === true
  return {
    verdict: added.length > 0 ? 'fail' : 'pass',
    setIdentical,
    countsMoved,
    added,
    newReds,
    newCollections,
    escalations,
    resolved,
    baseline,
    current,
    totals,
  }
}

/**
 * The sentence about counts, and it has to know whether the set moved before it opens its mouth.
 *
 * The first draft printed "COUNTS MOVED, SET DID NOT" whenever the counts differed from the
 * baseline document's own figures — and RED control D, which makes a red vanish into a collection
 * error, caught it saying exactly that on a run whose identity set HAD changed while naming an
 * escalation in the same line. A verdict channel that contradicts itself two clauses later is worse
 * than one that says nothing, because the reader has to guess which clause to believe.
 */
/**
 * A filename-safe UTC stamp for evidence files, e.g. `20261008T132031Z`.
 *
 * Evidence named after `process.pid` alone is evidence waiting to be overwritten: every tool call in
 * this environment runs in its own PID namespace, so pids are REUSED across runs, and a census run
 * started later can land on the pid of an earlier one and replace its comparison sidecar. That is not
 * hypothetical — two sidecars from this lane's own runs collided that way. The stamp makes each run's
 * artifacts addressable for as long as the directory lives.
 */
export function evidenceStamp(iso) {
  return String(iso).replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace(/\+.*$/, 'Z')
}

export function countsSentence(totals, setIdentical) {
  if (totals === null || !totals.moved || totals.declared == null) return ''
  const counts = `${String(totals.captured)} vs the baseline document's own ${String(totals.declared.files)} / ${String(totals.declared.legs)}`
  return setIdentical
    ? `COUNTS MOVED, SET DID NOT — ${counts}; the counts are context and the identity set is the verdict`
    : `COUNTS ALSO MOVED (${counts}) — and the identity set moved too, so the set, not the counts, is what this verdict is drawn from`
}

// ────────────────────────────────────────────────────────────────────────── fence comparison ──

/**
 * Parse the blueprint fence's report into the gate's own vocabulary. The rules are the ones
 * `packages/testkit/test/a4p7-merge-gate.test.ts` already enforces inside the suite, applied
 * here to the CLI run so the outer entry point is not lazier than the inner one: no `RESULT`
 * line is a refusal, `RESULT not-run` is a refusal, a verdict line that contradicts its own
 * counts is a failure, and a clean claim over a zero-file universe is a refusal.
 */
export function classifyFenceReport(stdout) {
  const text = String(stdout)
  const lines = text.split('\n')
  const results = lines.filter((l) => l.startsWith('RESULT '))
  // Counts and universe are parsed FIRST and carried into every return, including the refusals:
  // a reader of a failed leg needs to see what the fence actually reported, and a test that wants
  // to distinguish "parsed 3 dirty files and disagreed" from "parsed nothing and defaulted" can
  // only do that if both are visible. The `m` flag is load-bearing — without it `^RESULT dirty(`
  // can only match at offset 0, and every real report begins with `scanned-in-scope:`, so the
  // counts would silently parse as null and the contradiction check below would fire on its own
  // -1 default: a right answer for the wrong reason, which is the failure class this file exists
  // to remove.
  const count = (name) => {
    const m = new RegExp(`^RESULT ${name}\\((\\d+) files?, (\\d+) sites?\\)`, 'm').exec(text)
    return m === null ? null : { files: Number(m[1]), sites: Number(m[2]) }
  }
  const seen = {
    scanned: Number(/scanned-in-scope: (\d+) tracked files/.exec(text)?.[1] ?? '0'),
    dirty: count('dirty'),
    unknown: count('unknown'),
  }
  if (results.length === 0) {
    return { ...seen, verdict: 'fail', reason: 'the fence printed no RESULT line at all; silence is not a clean tree' }
  }
  const notRun = results.find((l) => l.startsWith('RESULT not-run'))
  if (notRun !== undefined) {
    return { ...seen, verdict: 'fail', reason: `the fence refused: ${notRun}` }
  }
  if (seen.scanned === 0) {
    return { ...seen, verdict: 'fail', reason: 'the fence reported a zero-file universe; a verdict with no stated universe cannot be reviewed' }
  }
  const verdictLine = results.find((l) => l.includes('verdict')) ?? ''
  const claimsClean = /verdict:\s*clean/.test(verdictLine)
  if (claimsClean && ((seen.dirty?.files ?? -1) !== 0 || (seen.unknown?.files ?? -1) !== 0)) {
    return {
      ...seen,
      verdict: 'fail',
      reason: `the fence says clean while reporting dirty(${String(seen.dirty?.files)}) / unknown(${String(seen.unknown?.files)}): ${verdictLine}`,
    }
  }
  const identities = lines.filter((l) => /^(OFFENDING|UNKNOWN)\s/.test(l)).sort()
  const enumerated = identities.length
  if (!claimsClean && enumerated < Math.max(seen.dirty?.files ?? 0, 0)) {
    return {
      ...seen,
      verdict: 'fail',
      reason: `the fence reported ${String(seen.dirty?.files)} dirty file(s) but enumerated ${String(enumerated)} — a verdict without the offending set by path cannot be reviewed`,
    }
  }
  return {
    ...seen,
    verdict: 'ran',
    identities,
    claimsClean,
    verdictLine,
  }
}

// ───────────────────────────────────────────────────────────────────── transcript checker ─────

/**
 * Grade a captured transcript by the rule the whole file exists for: **no token ⇒ fail.**
 * Also refuses a transcript that ends mid-leg: a leg that started and never printed its verdict
 * is a killed run, and a killed run is not a pass with less evidence attached.
 */
export function checkTranscript(text) {
  const s = String(text)
  const legs = [...s.matchAll(/^DSH-CI-LEG leg=(\S+) verdict=(\S+)/gm)].map((m) => ({
    leg: m[1],
    verdict: m[2],
  }))
  const finals = [...s.matchAll(/^DSH-CI-VERDICT (pass|fail)\b(.*)$/gm)]
  if (finals.length === 0) {
    return {
      verdict: 'fail',
      klass: 'missing-token',
      reason: `no DSH-CI-VERDICT token in the transcript (${String(legs.length)} leg line(s) seen) — a missing verdict is a failure, never "not run"`,
      legs,
    }
  }
  if (finals.length > 1) {
    return { verdict: 'fail', klass: 'duplicate-token', reason: `${String(finals.length)} DSH-CI-VERDICT lines; a run states one verdict`, legs }
  }
  const claimed = /legs=(\d+)/.exec(finals[0][2] ?? '')
  if (claimed !== null && Number(claimed[1]) !== legs.length) {
    return {
      verdict: 'fail',
      klass: 'truncated',
      reason: `the verdict claims ${claimed[1]} leg(s) but the transcript carries ${String(legs.length)} — the run stopped mid-leg`,
      legs,
    }
  }
  // Refusals must match in BOTH directions. A leg that refused without being declared is a
  // hidden skip; a token declaring a refusal that never refused is a token that lies. A
  // transcript from before this word existed carries neither field and is graded as before.
  const refusedLegs = legs.filter((l) => l.verdict === 'refused').map((l) => l.leg)
  const refusedClaim = /refusedlegs=(\S+)/.exec(finals[0][2] ?? '')
  const declaredRefused = refusedClaim !== null && refusedClaim[1] !== 'none' ? refusedClaim[1].split(',') : []
  const undeclared = refusedLegs.filter((l) => !declaredRefused.includes(l))
  if (undeclared.length > 0) {
    return {
      verdict: 'fail',
      klass: 'undeclared-refusal',
      reason: `leg(s) ${undeclared.join(',')} report refused while the token declares refusedlegs=${declaredRefused.join(',') || 'none'} — a refusal has to be written into the invocation, not discovered afterwards`,
      legs,
    }
  }
  const phantom = declaredRefused.filter((l) => !refusedLegs.includes(l))
  if (phantom.length > 0) {
    return {
      verdict: 'fail',
      klass: 'token-legs-disagree',
      reason: `the token declares refusedlegs=${declaredRefused.join(',')} but no leg line refused for ${phantom.join(',')} — a declared refusal that did not refuse is a token that lies`,
      legs,
    }
  }
  const fails = legs.filter((l) => l.verdict === 'fail').map((l) => l.leg)
  const finalVerdict = finals[0][1]
  if (finalVerdict === 'fail' && fails.length === 0) {
    return { verdict: 'fail', klass: 'token-legs-disagree', reason: 'the final verdict is fail but no leg line says fail — the token and its legs disagree', legs }
  }
  if (finalVerdict === 'pass' && fails.length > 0) {
    return { verdict: 'fail', klass: 'token-legs-disagree', reason: `the final verdict is pass while leg(s) ${fails.join(',')} report fail`, legs }
  }
  // A transcript of a RED run is graded `fail` with exit 1 — CI must fail when the gate failed —
  // but it gets its own class, because "the gate refused this tree" and "the transcript cannot be
  // trusted" are different sentences and a reader who conflates them will either ignore red runs or
  // chase phantom instrument faults.
  if (finalVerdict === 'fail') {
    return { verdict: 'fail', klass: 'red-run', reason: `the gate ran and refused: ${fails.join(',')} reported fail`, legs }
  }
  return { verdict: finalVerdict, klass: 'ok', reason: `${String(legs.length)} leg(s), final token ${finalVerdict}`, legs }
}

// ───────────────────────────────────────────────────────────────────────────────── legs ───────

/**
 * Every leg returns `{verdict, detail}` with verdict ∈ pass|fail|skip. A leg NEVER throws to
 * signal a problem: an uncaught throw would end the run before the final token, and per the
 * first rule that is a fail with extra steps — which is still correct, but by accident rather
 * than by design. Throwing is reserved for "this gate cannot grade anything" (a missing
 * baseline file), which the harness turns into `fail` with the reason.
 */
const LEGS = {
  // Takes no ctx: this leg runs one parser over one file, and writing `ctx` to satisfy the
  // harness signature would imply it uses the run context when it does not.
  'graph-parse'() {
    const abs = resolve(REPO_ROOT, GRAPH_YAML)
    if (!existsSync(abs)) {
      return { verdict: 'fail', detail: `${GRAPH_YAML} is absent; orchestration state cannot be unreadable and green` }
    }
    // Same parser as the installed pre-commit hook (dev/agent-workflow/hooks/pre-commit), so the
    // local guard and this gate cannot disagree about what "parses" means. Fail-closed on the
    // parser being missing: python3/PyYAML absent is a FAIL, not a skip — a check that skips
    // because its tool is unavailable is the exact shape of the #195 incident.
    const py = [
      'import sys, yaml',
      'try:',
      '    doc = yaml.safe_load(sys.stdin.read())',
      'except Exception as e:',
      '    print("PARSE-ERROR " + type(e).__name__ + ": " + str(e).replace("\\n", " | "))',
      '    sys.exit(1)',
      'if not isinstance(doc, dict) or len(doc) == 0:',
      '    print("SHAPE-ERROR top-level " + type(doc).__name__ + " is not a non-empty mapping")',
      '    sys.exit(3)',
      'print("OK mapping-keys " + str(len(doc)))',
    ].join('\n')
    const r = runCommand('python3', ['-c', py], { input: readFileSync(abs, 'utf8') })
    if (r.error !== null) {
      return {
        verdict: 'fail',
        detail: `YAML parser unavailable (${r.error}); refusing to call unreadable authority state green. ` +
          `Install python3 with PyYAML (the guard in dev/agent-workflow/hooks/pre-commit uses the same one).`,
      }
    }
    const out = `${r.stdout}${r.stderr}`.trim()
    if (r.code === 0) return { verdict: 'pass', detail: `${GRAPH_YAML} parses: ${out.split('\n').pop()}` }
    if (r.code === 1) return { verdict: 'fail', detail: `${GRAPH_YAML} does not parse — ${tail(out, 3)}` }
    if (r.code === 3) return { verdict: 'fail', detail: `${GRAPH_YAML} parsed but is not a non-empty mapping — ${tail(out, 3)}` }
    return { verdict: 'fail', detail: `${GRAPH_YAML} leg could not run (exit ${String(r.code)}, signal ${String(r.signal)}): ${tail(out, 3)}` }
  },

  'state-freshness'() {
    const gp = resolve(REPO_ROOT, GRAPH_YAML)
    const lp = resolve(REPO_ROOT, 'dev/agent-workflow/SESSION_ROUTER_LOG.md')
    for (const [what, abs] of [['graph', gp], ['log', lp]]) {
      if (!existsSync(abs)) return { verdict: 'fail', detail: `${what} state file is absent (${abs}); recovery state cannot be missing and green` }
    }
    const head = runCommand('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT })
    if (head.code !== 0) {
      return { verdict: 'refused', refuseReason: 'git-unavailable', detail: 'REFUSED: state freshness is graded against git and git did not run' }
    }
    const isAncestor = (sha) => runCommand('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: REPO_ROOT }).code === 0
    const { findings, info } = checkStatePointers({ graphText: readFileSync(gp, 'utf8'), logText: readFileSync(lp, 'utf8'), isAncestor })
    if (findings.length > 0) return { verdict: 'fail', detail: findings.join(' ; ') }
    const lagM = runCommand('git', ['rev-list', '--count', `${String(info.declared_sha)}..HEAD`], { cwd: REPO_ROOT })
    const lag = lagM.code === 0 ? `lag ${lagM.stdout.trim()} commits` : 'lag unknown'
    return {
      verdict: 'pass',
      detail: `pointer agrees both ways (round ${String(info.declared_round)} = newest record = last log heading), records contiguous, ` +
        `${String(info.declared_sha)} reachable (${lag}); code truth stays in git, orchestration state here, recovery read starts in the log`,
    }
  },

  install(ctx) {
    const args = ['install', '--frozen-lockfile']
    if (ctx.storeDir !== null) args.push(`--store-dir=${ctx.storeDir}`)
    const r = runCommand('pnpm', args)
    if (r.error !== null) return { verdict: 'fail', detail: `pnpm could not be spawned: ${r.error}` }
    if (r.code !== 0) {
      return { verdict: 'fail', detail: `\`pnpm ${args.join(' ')}\` exited ${String(r.code)}${r.signal === null ? '' : ` on signal ${String(r.signal)}`}: ${tail(r.stdout + r.stderr)}` }
    }
    return { verdict: 'pass', detail: `pnpm ${args.join(' ')} ok${ctx.storeDir !== null ? ' (store-dir workaround in force)' : ''}` }
  },

  'blueprint-fence'(ctx) {
    const baseline = readLineBaseline(ctx.baselines.fence)
    const r = runCommand(process.execPath, ['scripts/verify-blueprint-version-clean.mjs'])
    ctx.capture('blueprint-fence', r)
    if (r.error !== null) return { verdict: 'fail', detail: `the fence could not be spawned: ${r.error}` }
    const c = classifyFenceReport(r.stdout)
    if (c.verdict === 'fail') return { verdict: 'fail', detail: c.reason }
    const current = [...new Set(c.identities)].sort()
    const fresh = current.filter((l) => !baseline.includes(l))
    const gone = baseline.filter((l) => !current.includes(l))
    const counts = `dirty ${String(c.dirty?.files ?? '?')} files/${String(c.dirty?.sites ?? '?')} sites, unknown ${String(c.unknown?.files ?? '?')} files, universe ${String(c.scanned)} tracked files, baseline ${String(baseline.length)} identities`
    if (fresh.length > 0) {
      return {
        verdict: 'fail',
        detail: `${String(fresh.length)} NEW offending path(s) vs ${ctx.baselines.fence} — ${fresh.slice(0, 5).join(' ;; ')}${fresh.length > 5 ? ` (+${String(fresh.length - 5)} more)` : ''}`,
        data: { fresh },
      }
    }
    return {
      verdict: 'pass',
      detail: `no new offending path (${counts})${gone.length > 0 ? `; ${String(gone.length)} baseline identity/ies RESOLVED — re-record the fence baseline in the open, not from here` : ''}`,
    }
  },

  typecheck(ctx) {
    const r = runCommand('pnpm', ['typecheck'])
    ctx.capture('typecheck', r)
    if (r.error !== null) return { verdict: 'fail', detail: `pnpm could not be spawned: ${r.error}` }
    if (r.signal !== null) return { verdict: 'fail', detail: `pnpm typecheck killed by ${String(r.signal)} — no typecheck, no pass` }
    if (r.code !== 0) return { verdict: 'fail', detail: `pnpm typecheck exited ${String(r.code)}: ${tail(r.stdout + r.stderr, 20)}` }
    return { verdict: 'pass', detail: 'pnpm typecheck clean (all packages, tests included — tsc is the only leg that sees a bad .test.ts)' }
  },

  'lint-identities'(ctx) {
    const r = runCommand(process.execPath, ['scripts/lint-identities.mjs', '--diff', ctx.baselines.lint])
    ctx.capture('lint-identities', r)
    if (r.error !== null) return { verdict: 'fail', detail: `lint-identities could not be spawned: ${r.error}` }
    const out = `${r.stdout}\n${r.stderr}`
    if (r.code === 2) {
      return { verdict: 'fail', detail: `lint-identities NOT RUN (exit 2) — an ESLint run that produced no parseable JSON has no opinion about identity diffs: ${tail(out, 8)}` }
    }
    if (r.code === 1) {
      const fresh = (r.stderr ?? '').split('\n').filter((l) => /^\s{2}\S/.test(l))
      return { verdict: 'fail', detail: `${String(fresh.length)} NEW lint identities vs ${ctx.baselines.lint}: ${fresh.slice(0, 5).map((l) => l.trim()).join(' ;; ')}` }
    }
    if (r.code !== 0) return { verdict: 'fail', detail: `lint-identities exited ${String(r.code)} (only 0 = "no new identity" is a pass): ${tail(out, 8)}` }
    const summary = (r.stdout ?? '').split('\n').find((l) => l.startsWith('baseline ')) ?? ''
    // The standing condition is disclosed, not asserted clean: `pnpm lint` is red at master by
    // ruling, and this leg's whole point is that red is not the same question as "new".
    return { verdict: 'pass', detail: `identity diff clean (${summary}) — exit code of \`pnpm lint\` is NOT the authority here; the identity set is` }
  },

  'artifacts-at-head'(ctx) {
    const args = ['scripts/check-artifacts-at-head.mjs']
    // Space-separated, not `--store-dir=…`: that instrument's own parser throws
    // `unknown argument: --store-dir=…` and dies BEFORE emitting any DSH-ARTIFACT-VERDICT line, so
    // the equal-sign form is not a style choice here. The first real run of this leg made exactly
    // that mistake, and the leg refused rather than going green on it — which is the fail-closed
    // rule earning its keep on the author's own bug.
    if (ctx.storeDir !== null) args.push('--store-dir', ctx.storeDir)
    const r = runCommand(process.execPath, args)
    ctx.capture('artifacts-at-head', r)
    if (r.error !== null) return { verdict: 'fail', detail: `check-artifacts-at-head could not be spawned: ${r.error}` }
    const out = `${r.stdout}\n${r.stderr}`
    const line = out.split('\n').find((l) => l.includes('DSH-ARTIFACT-VERDICT') && l.includes('script=check-artifacts-at-head'))
    if (line === undefined) {
      return { verdict: 'fail', detail: `no DSH-ARTIFACT-VERDICT line with script=check-artifacts-at-head (exit ${String(r.code)}): ${tail(out, 8)}` }
    }
    const field = (k) => new RegExp(`\\b${k}=(\\S+)`).exec(line)?.[1] ?? null
    const verdict = field('verdict')
    const drift = field('drift')
    if (verdict !== 'ok') {
      return { verdict: 'fail', detail: `committed install surface verdict=${verdict} reason=${String(field('reason'))}: ${tail(out, 8)}` }
    }
    if (drift !== null && drift !== '0') {
      return { verdict: 'fail', detail: `verdict=ok but drift=${drift} — the token contradicts itself, so neither can be trusted` }
    }
    if (r.code !== 0) {
      return { verdict: 'fail', detail: `verdict=ok but the instrument exited ${String(r.code)}; the token and the code disagree: ${tail(out, 6)}` }
    }
    return { verdict: 'pass', detail: `HEAD carries its own build (${line.trim()})` }
  },

  census(ctx) {
    // PREFLIGHT. The reason this exists is measured, not assumed: on a runner without the
    // gitignored pristine host checkout the census produced 57 failures wearing the product's
    // name — 38 file-level, whose error text is literally `no repo root with
    // tests/deepseek-harness-test-use`, and 19 named-leg assertions I then reproduced LOCALLY,
    // string for string, by hiding that one directory (same AssertionError in t2-blueprint-hash,
    // same MessagingError in p6t3-restart). Those legs resolve that checkout to spawn a host, so
    // on such a runner they are ungradeable, and running them anyway is not diligence — it is a
    // false accusation. Re-grading a stored report needs no checkout, hence the guard.
    if (ctx.censusJson === null && !existsSync(join(REPO_ROOT, 'tests', 'deepseek-harness-test-use'))) {
      return {
        verdict: 'refused',
        refuseReason: 'missing-test-use-checkout',
        detail:
          'REFUSED before spawning vitest: tests/deepseek-harness-test-use (the pristine test host, ' +
          'gitignored, pinned by tests/paths.mjs) is absent from this checkout, and census legs that ' +
          'resolve it cannot be graded here. Measured consequence of running anyway: 38 file-level + 19 ' +
          'named-leg failures, all reproducible by hiding that directory (evidence/a4-pr7/ci-gate/' +
          'FINDINGS.md, hosted run 37794562230). Provision it per docs/TEST_METHODS.md §2 to make the ' +
          'leg meaningful, or declare the refusal (--allow-refused census) so this checkout says out ' +
          'loud that the population was not measured here.',
      }
    }
    const baseline = parsePopulationBaseline(readFileSync(resolve(REPO_ROOT, ctx.baselines.census), 'utf8'))
    const reports = []
    if (ctx.censusJson !== null) {
      // Re-grade a stored report instead of re-running the suite: the same comparison code, no
      // ~100 s vitest. Used to re-check a published census and to show the escalation class on a
      // real report whose bytes are otherwise expensive to reproduce.
      const abs = resolve(process.cwd(), ctx.censusJson)
      if (!existsSync(abs)) return { verdict: 'fail', detail: `--census-json points at nothing: ${ctx.censusJson}` }
      reports.push({ jsonPath: abs, ids: ctx.idsFromReport(abs, 'census-json'), ...ctx.shapeFromReport(abs), gradedFromStoredReport: true })
    }
    for (let i = 1; ctx.censusJson === null && i <= ctx.censusCaptures; i += 1) {
      const jsonPath = join(ctx.scratchDir, `census-${ctx.stamp}-${String(process.pid)}-${i}.json`)
      if (i === 1) {
        // The suite's own fault-injection scratch; left over from an earlier run it changes what
        // the testkit lane sees, so every published census clears it first.
        rmSync(resolve(REPO_ROOT, 'packages/testkit/test/.tmp-fault'), { recursive: true, force: true })
      }
      const run = runCommand('pnpm', [
        'exec', 'vitest', 'run',
        '--reporter=default',
        '--reporter=json',
        `--outputFile.json=${jsonPath}`,
        // Only when an operator said so, and the value then appears on the leg line. A census that
        // passed under a raised clock and one that passed under the suite's default are different
        // claims, and the transcript has to distinguish them by itself.
        ...(ctx.censusTestTimeout === null ? [] : [`--testTimeout=${String(ctx.censusTestTimeout)}`]),
      ])
      ctx.capture(`census-capture-${String(i)}`, run)
      if (run.error !== null) {
        return { verdict: 'fail', detail: `vitest could not be spawned: ${run.error}` }
      }
      if (!existsSync(jsonPath)) {
        // Exit 1 is EXPECTED (22 disclosed reds); the absence of the report is the real failure.
        return { verdict: 'fail', detail: `vitest exited ${String(run.code)} and wrote no JSON report to ${jsonPath}; a census with no report cannot be diffed: ${tail(run.stdout + run.stderr, 10)}` }
      }
      reports.push({ jsonPath, ids: ctx.idsFromReport(jsonPath, `census-ids-${String(i)}`), ...ctx.shapeFromReport(jsonPath) })
    }

    const first = reports[0]
    // TWO CAPTURES ARE GRADED AS THE UNION OF WHAT THEY SAW, not as capture 1 with capture 2 as a
    // footnote. A red that appears once has happened: the baseline's own load-discipline note says
    // the COUNT moves with load and the identity SET is what must be defended, so the conservative
    // direction is union, and a family red seen once faces the re-sample protocol below instead of
    // disappearing because a second process finished differently.
    const currentIds = [...new Set(reports.flatMap((r) => r.ids))].sort()
    const declared = baseline.declaredTotals
    const totals = {
      files: first.files,
      legs: first.legs,
      declared,
      // "The count moved but the set did not" is a sentence this gate must be able to say out
      // loud, because a leg that VANISHES (into a collection error) also lowers a count. So the
      // note is printed whenever the counts differ from the baseline document's own figures, and
      // the escalation rule above is what decides whether a lower count is good news.
      moved: declared !== null && reports.some((r) => r.files !== declared.files || r.legs !== declared.legs),
      capturesAgree: reports.length < 2
        ? 'single capture'
        : reports.every((r) => r.ids.join('\n') === currentIds.join('\n'))
          ? `${String(reports.length)} captures, identical identity sets`
          : `${String(reports.length)} captures, identity sets DIFFER — graded as the union, so a red seen once is a red`,
      captured: reports.map((r) => `${String(r.files)}f/${String(r.legs)}l`).join(', '),
      totalsNote: `captured ${reports.map((r) => `${String(r.files)}f/${String(r.legs)}l`).join(', ')}` +
        (declared === null
          ? ' (baseline declares no totals; counts are context here)'
          : ` vs baseline-declared ${String(declared.files)} / ${String(declared.legs)}`),
    }
    let cmp = compareCensus(baseline.ids, currentIds, totals)

    // The disclosed load family, handled the way the baseline file demands: re-sample, publish
    // the rate, and let a red that survives be a red.
    let flakeNote = ''
    if (cmp.added.length > 0 && baseline.loadFamilies.length > 0) {
      const familyOf = (id) => baseline.loadFamilies.find((f) => id.includes(f))
      const fileOf = (id) => id.slice(id.indexOf(' ') + 1, id.indexOf('::'))
      const inFamily = cmp.added.filter((id) => familyOf(id) !== undefined)
      const outside = cmp.added.filter((id) => familyOf(id) === undefined)
      if (inFamily.length > 0 && outside.length > 0) {
        flakeNote = ` || NO TOLERANCE FOR THE OTHERS: ${String(inFamily.length)} new red(s) fall in a disclosed family ` +
          `(${baseline.loadFamilies.join(', ')}) and ${String(outside.length)} do not — the re-sample protocol covers only the family, ` +
          'so the leg fails on the undisclosed ones regardless of how the family re-samples.'
      }
      else if (inFamily.length > 0) {
        // The baseline's own words: "a family red is dismissed only by ≥3 re-samples whose rate you
        // publish". Every disclosed file that contributed a red is re-sampled — not one nominated
        // by this script — and one non-green re-sample anywhere keeps the red.
        const files = [...new Set(inFamily.map(fileOf))]
        const rates = []
        let allGreen = true
        for (const file of files) {
          let green = 0
          for (let k = 1; k <= ctx.resample; k += 1) {
            rmSync(resolve(REPO_ROOT, 'packages/testkit/test/.tmp-fault'), { recursive: true, force: true })
            const rp = join(ctx.scratchDir, `resample-${String(process.pid)}-${file.replace(/[^a-zA-Z0-9]/g, '_')}-${String(k)}.json`)
            const run = runCommand('pnpm', ['exec', 'vitest', 'run', file, '--reporter=json', `--outputFile.json=${rp}`,
              ...(ctx.censusTestTimeout === null ? [] : [`--testTimeout=${String(ctx.censusTestTimeout)}`])])
            ctx.capture(`census-resample-${file.replace(/[^a-zA-Z0-9]/g, '_')}-${String(k)}`, run)
            if (run.error !== null || !existsSync(rp)) continue
            if (ctx.idsFromReport(rp, `resample-ids-${file.replace(/[^a-zA-Z0-9]/g, '_')}-${String(k)}`).length === 0) green += 1
          }
          rates.push(`${file} ${String(green)}/${String(ctx.resample)} green`)
          if (green !== ctx.resample) allGreen = false
        }
        flakeNote = ` || LOAD FAMILY: every new red is inside a family the BASELINE discloses ` +
          `(${baseline.loadFamilies.join(', ')}); re-samples — ${rates.join('; ')}. ` +
          'The baseline\'s rule is that a family red is dismissed only by ≥3 re-samples whose rate you publish, and this is that rate. ' +
          'Its own published solo rate is ~2/8, so even 3/3 green is a sample and not a property: the family stays disclosed debt, ' +
          'never a known-green one.'
        if (allGreen) {
          cmp = compareCensus(baseline.ids, currentIds.filter((id) => familyOf(id) === undefined), totals)
        }
      }
    }
    else if (cmp.added.length > 0) {
      flakeNote = ' || NO DISCLOSED FAMILY: the baseline names no load family, so nothing here is excusable and no re-sample was run.'
    }

    const parts = [
      `roots: nine (packages/*/test) via the root vitest config; baseline ${ctx.baselines.census} = ${String(baseline.titledCount)} titled reds + ${String(baseline.collectionCount)} collection files; ${cmp.totals.totalsNote}; ${cmp.totals.capturesAgree}`,
    ]
    // The clock is part of the claim. One walk leg in this suite takes 4.1–5.3 s and the suite sets
    // no testTimeout, so under the 5000 ms default its verdict is a race with the scheduler
    // (measured in DIAGNOSTIC-G: 5270 ms, PASSED, once the budget was raised — the assertion never
    // changed). Silence about the budget would let a pass under 20 s be read as a pass, full stop.
    parts.push(ctx.censusTestTimeout === null
      ? 'clock: the suite\'s own testTimeout (set nowhere, so vitest\'s 5000 ms default)'
      : `clock: --testTimeout=${String(ctx.censusTestTimeout)} ms, an operator override above the 5000 ms default`)
    if (reports.length > 0 && reports.every((r) => r.gradedFromStoredReport === true)) {
      parts.push('UNRERUN: graded from a stored vitest report (--census-json); no suite executed here, ' +
        `so this leg vouches for the comparison, not for the tree under test: ${reports[0].jsonPath}`)
    }
    // Named before anything cites it — the first version declared it after the `parts.push` that
    // referenced it and the leg died in the temporal dead zone, which is a two-line way of being a
    // broken instrument. It still produced a verdict, because of the `finally` guard.
    const sidecar = `census-comparison-${ctx.stamp}-${String(process.pid)}.json`
    const countsNote = countsSentence(cmp.totals, cmp.setIdentical)
    if (countsNote !== '') parts.push(countsNote)
    if (cmp.escalations.length > 0) parts.push(`ESCALATION (a lower red count is NOT a fix here): ${cmp.escalations.join(' // ')}`)
    if (cmp.newReds.length > 0) parts.push(`NEW RED(S) ${String(cmp.newReds.length)}: ${cmp.newReds.slice(0, 4).join(' ;; ')}${cmp.newReds.length > 4 ? ` (+${String(cmp.newReds.length - 4)} more)` : ''}`)
    if (cmp.newCollections.length > 0) parts.push(`NEW COLLECTION-ERROR FILE(S) ${String(cmp.newCollections.length)}: ${cmp.newCollections.join(' ;; ')}`)
    if (cmp.resolved.length > 0) parts.push(`resolved ${String(cmp.resolved.length)} (allowed: the stage may remove baseline debt, never add any)`)
    if (cmp.setIdentical) parts.push('identity set IDENTICAL to the published baseline')
    // Cite the sidecar by name: a transcript that says "there is a JSON somewhere in scratch/" is a
    // transcript a reader cannot check three runs later.
    parts.push(`comparison written to dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/${sidecar}`)

    ctx.writeJson(sidecar, {
      head: git(['rev-parse', 'HEAD']),
      baseline: ctx.baselines.census,
      baselineIds: baseline.ids,
      reports: reports.map((r) => ({ jsonPath: r.jsonPath, files: r.files, legs: r.legs, ids: r.ids })),
      comparison: { ...cmp, baseline: undefined, current: undefined },
    })

    return {
      verdict: cmp.verdict,
      detail: `${parts.join(' — ')}${flakeNote}`,
      data: { reports, comparison: cmp },
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────────── CLI ───────

function parseArgs(argv) {
  const opts = {
    full: false,
    only: null,
    skip: [],
    census: false,
    censusCaptures: 1,
    censusJson: null,
    // The wall-clock budget the census runs under. `null` means "whatever the suite's own config
    // says", and the suite sets none, so today that is vitest's 5000 ms default — which measurement
    // says is a coin flip for one walk leg on a loaded box (evidence/a4-pr7/ci-gate/transcripts/
    // DIAGNOSTIC-G-timeout-not-assertion.txt: the leg takes 4.1–4.6 s and crossed the budget on 3
    // captures of 8, while the same tree at a 20 s budget yields exactly the published 22
    // identities). This is an OPERATOR knob, not a tolerance: it moves the instrument's clock,
    // never the identity set it reports, and the value in force is printed on the census leg line
    // so a pass reads as "passed under a 20 s budget" instead of "passed".
    censusTestTimeout: null,
    resample: 3,
    // Legs whose `refused` verdict this invocation accepts. Declaring a refusal in the command
    // line is the whole design: the exemption is reviewable in the diff of the workflow, not
    // inferred from a green run.
    allowRefused: [],
    storeDir: process.env.DSH_CI_STORE_DIR ?? null,
    transcriptDir: null,
    baselines: { ...BASELINES },
    selfTest: false,
    checkTranscript: null,
    listLegs: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--help' || a === '-h') opts.help = true
    else if (a === '--full') opts.full = true
    else if (a === '--census') opts.census = true
    else if (a === '--census-captures') opts.censusCaptures = Number(argv[(i += 1)])
    else if (a === '--census-json') opts.censusJson = argv[(i += 1)]
    else if (a === '--census-test-timeout') opts.censusTestTimeout = Number(argv[(i += 1)])
    else if (a === '--resample') opts.resample = Number(argv[(i += 1)])
    else if (a === '--allow-refused') opts.allowRefused.push(...String(argv[(i += 1)]).split(',').map((x) => x.trim()).filter(Boolean))
    else if (a === '--only') {
      // Repeated --only ACCUMULATES, like --skip beside it. It used to overwrite, so
      // `--only graph-parse --only state-freshness` silently ran ONE leg and printed legs=1 — a
      // verification that looks like it covered two things and covered one. Measured the hard way
      // while adding the state-freshness leg, which is why the fix is here and not a comment.
      const names = String(argv[(i += 1)]).split(',').map((s) => s.trim()).filter(Boolean)
      opts.only = [...(opts.only ?? []), ...names]
    }
    else if (a === '--skip') opts.skip.push(...String(argv[(i += 1)]).split(',').map((s) => s.trim()).filter(Boolean))
    else if (a === '--store-dir') opts.storeDir = argv[(i += 1)]
    else if (a === '--transcript-dir') opts.transcriptDir = argv[(i += 1)]
    else if (a === '--baseline-census') opts.baselines.census = argv[(i += 1)]
    else if (a === '--baseline-fence') opts.baselines.fence = argv[(i += 1)]
    else if (a === '--baseline-lint') opts.baselines.lint = argv[(i += 1)]
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--check-transcript') opts.checkTranscript = argv[(i += 1)]
    else if (a === '--list-legs') opts.listLegs = true
    else throw new Error(`unknown argument: ${String(a)}`)
  }
  if (opts.censusTestTimeout !== null && !(Number.isFinite(opts.censusTestTimeout) && opts.censusTestTimeout >= 1000)) {
    throw new Error(`--census-test-timeout wants a whole number of ms >= 1000, got ${String(opts.censusTestTimeout)}`)
  }
  if (!Number.isInteger(opts.censusCaptures) || opts.censusCaptures < 1) throw new Error('--census-captures must be a positive integer')
  if (!Number.isInteger(opts.resample) || opts.resample < 3) throw new Error('--resample must be an integer ≥3 (the published baseline rule)')
  const unknown = [...(opts.only ?? []), ...opts.skip].filter((n) => !LEG_ORDER.includes(n))
  if (unknown.length > 0) throw new Error(`unknown leg name(s): ${unknown.join(', ')} (known: ${LEG_ORDER.join(', ')})`)
  return opts
}

/** Reduce a vitest JSON report to fail-set identities by CALLING the existing tool. */
function idsFromReport(jsonPath, label) {
  const r = runCommand(process.execPath, ['scripts/fail-set.mjs', 'capture', jsonPath])
  if (r.code !== 0) throw new Error(`${label}: scripts/fail-set.mjs capture exited ${String(r.code)}: ${tail(r.stdout + r.stderr, 5)}`)
  return [...new Set(r.stdout.split('\n').filter((l) => /^(TEST|FILE)\s/.test(l)))].sort()
}

/** Files and registered legs, for context lines only. */
function shapeFromReport(jsonPath) {
  const report = JSON.parse(readFileSync(jsonPath, 'utf8'))
  const files = Array.isArray(report?.testResults) ? report.testResults : []
  let legs = 0
  for (const f of files) legs += Array.isArray(f?.assertionResults) ? f.assertionResults.length : 0
  return { files: files.length, legs }
}

function main(argv) {
  const opts = parseArgs(argv)

  if (opts.help) {
    process.stdout.write([
      'usage: node scripts/ci-pr-gate.mjs [options]',
      '',
      '  (no flags)            required legs; the census prints a named SKIP (it is the heaviest leg)',
      '  --full                every leg, and ANY skip is a failure (this is what CI runs)',
      '  --census              include the nine-root census (~100 s here; see evidence/a4-pr7/ci-gate)',
      '  --census-captures N   capture the census N times (plan A1.2.1 wants 2 before a NEW baseline)',
      '  --census-json FILE    grade a stored vitest JSON report instead of re-running the suite',
      '  --census-test-timeout MS',
      "                        run the suite with --testTimeout=MS; the suite sets none, so the",
      '                        default is vitest\'s 5000 ms. The value in force is printed on the',
      '                        census leg line: a pass states the clock it passed under.',
      '  --resample N          load-family re-samples (>=3, the published baseline rule)',
      '  --only a,b,c          run a subset (RED controls, review re-runs)',
      '  --skip a,b            skip a leg, named on the token channel',
      '  --store-dir PATH      pnpm store for install + artifacts-at-head (this repo needs it sandboxed)',
      '  --transcript-dir DIR  write one full capture per leg',
      '  --check-transcript F  grade a transcript by the missing-token rule (no token => fail)',
      '  --self-test           pin the verdict algebra in milliseconds',
      '  --list-legs           leg names and whether each is required',
      '',
      'verdict channel: DSH-CI-LEG leg=… verdict=pass|fail|skip …  then exactly one',
      '                 DSH-CI-VERDICT pass|fail … ; a missing DSH-CI-VERDICT means FAIL.',
      '',
    ].join('\n'))
    return 0
  }

  if (opts.listLegs) {
    for (const name of LEG_ORDER) {
      process.stdout.write(`${name}\t${OPTIONAL_BY_DEFAULT.has(name) && !opts.full ? 'opt-in (SKIP by default)' : 'required'}\n`)
    }
    return 0
  }

  if (opts.checkTranscript !== null) {
    const abs = resolve(process.cwd(), opts.checkTranscript)
    const checked = checkTranscript(readFileSync(abs, 'utf8'))
    process.stdout.write(`DSH-CI-TRANSCRIPT-CHECK ${checked.verdict} class=${String(checked.klass ?? 'unknown')} :: ${checked.reason}\n`)
    return checked.verdict === 'pass' ? 0 : 1
  }

  if (opts.selfTest) return selfTest()

  const scratchDir = resolve(REPO_ROOT, 'dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch')
  mkdirSync(scratchDir, { recursive: true })
  const transcriptDir = opts.transcriptDir === null ? null : resolve(process.cwd(), opts.transcriptDir)
  if (transcriptDir !== null) mkdirSync(transcriptDir, { recursive: true })

  const ctx = {
    storeDir: opts.storeDir,
    baselines: opts.baselines,
    stamp: evidenceStamp(new Date().toISOString()),
    censusCaptures: opts.censusCaptures,
    censusTestTimeout: opts.censusTestTimeout,
    censusJson: opts.censusJson,
    resample: opts.resample,
    scratchDir,
    capture(label, r) {
      const text = [
        `$ ${r.command} ${r.args.join(' ')}`,
        `# exit=${String(r.code)} signal=${String(r.signal)} error=${String(r.error ?? 'none')} seconds=${String(r.seconds)}`,
        '--- stdout ---',
        r.stdout,
        '--- stderr ---',
        r.stderr,
      ].join('\n')
      process.stdout.write(`  [${label}] exit=${String(r.code)} ${tail(r.stdout + r.stderr, 3)}\n`)
      if (transcriptDir === null) return
      writeFileSync(join(transcriptDir, `${label}.txt`), `${text}\n`)
    },
    /** Structured evidence for a leg whose verdict is a SET, not a boolean. */
    writeJson(name, obj) {
      writeFileSync(join(scratchDir, name), `${JSON.stringify(obj, null, 2)}\n`)
    },
    idsFromReport,
    shapeFromReport,
  }

  const wanted = opts.only ?? LEG_ORDER
  // ONE object holds every number the final token states. On the first draft the skip NAMES lived
  // in a sibling array while the token builder read `counts.skipped`, so the run died with a
  // TypeError between the last leg line and the token — i.e. it produced exactly the tokenless
  // output that this gate is defined to treat as a failure. That crash is reproduced on demand in
  // evidence/a4-pr7/ci-gate/transcripts/RED-CONTROL-E-tokenless-run.txt.
  // A verdict channel that can crash on its own bookkeeping is not a channel.
  const counts = { pass: 0, fail: 0, skip: 0, legs: 0, skipped: [], refused: 0, refusedList: [] }
  const started = Date.now()
  process.stdout.write(
    `DSH-CI-RUN head=${String(git(['rev-parse', '--short', 'HEAD']) ?? 'unknown')} mode=${opts.full ? 'full' : 'default'} ` +
      `node=${process.version} cwd=${REPO_ROOT} store-dir=${String(ctx.storeDir ?? 'default')} ` +
     `allow-refused=${(opts.allowRefused ?? []).length > 0 ? opts.allowRefused.join(',') : 'none'}\n`,
  )

  // The token is printed from a `finally` and guarded by a flag: a throw anywhere in the loop —
  // including one in this file's own bookkeeping, which happened for real on the first draft —
  // still states a verdict. "No token" is a rule for OTHER people's transcripts; this process
  // never gets to be the one that relies on it.
  let tokenPrinted = false
  const printToken = (verdict, extra = '') => {
    const secs = Number(((Date.now() - started) / 1000).toFixed(1))
    process.stdout.write(`${finalToken(verdict, counts)} seconds=${String(secs)}${extra}\n`)
    tokenPrinted = true
  }
  try {
      for (const name of LEG_ORDER) {
        if (!wanted.includes(name)) {
          continue
        }
        if (opts.skip.includes(name)) {
          counts.skip += 1
          counts.legs += 1
          counts.skipped.push(name)
          process.stdout.write(`${legLine({ leg: name, verdict: 'skip', seconds: 0, detail: `skipped by explicit --skip ${name}` })}\n`)
          continue
        }
        if (!opts.full && !opts.census && opts.censusJson === null && OPTIONAL_BY_DEFAULT.has(name) && opts.only === null) {
          counts.skip += 1
          counts.legs += 1
          counts.skipped.push(name)
          process.stdout.write(
            `${legLine({
              leg: name,
              verdict: 'skip',
              seconds: 0,
              detail: 'NOT RUN — heaviest leg, opt-in. Enable with --census (or --full, which is what CI runs). A named skip is a disclosure, never a silence.',
            })}\n`,
          )
          continue
        }
        counts.legs += 1
        const legStarted = Date.now()
        let result
        try {
          result = LEGS[name](ctx)
        } catch (e) {
          // A leg that could not be graded is a fail, stated as one, with the cause. The gate still
          // reaches its final token — the run never ends in silence.
          result = { verdict: 'fail', detail: `leg threw: ${String(e && e.message ? e.message : e)}` }
        }
        if (result.verdict === 'skip' && opts.full) {
          // A leg that abstains in a full run has abstained from the merge gate.
          result = { verdict: 'fail', detail: `(under --full a skip is a failure) ${result.detail}` }
        }
        const outcome = applyRefusalPolicy(name, result, opts.allowRefused)
        const seconds = Number(((Date.now() - legStarted) / 1000).toFixed(1))
        counts[outcome.verdict] += 1
        if (outcome.verdict === 'refused') {
          counts.refusedList.push(name)
          // A separate machine token: an operator who greps for refusals must not have to parse
          // prose, and a dashboard that counts `verdict=pass` must not quietly absorb this leg.
          process.stdout.write(
            `DSH-CI-REFUSED leg=${name} declared=yes reason=${String(outcome.refuseReason ?? 'unspecified')}\n`,
          )
        }
        process.stdout.write(
          `${legLine({ leg: name, verdict: outcome.verdict, seconds, detail: outcome.detail })}\n`,
        )
        // The token line stays greppable by truncating; the whole sentence goes on the next line,
        // because the census detail is the finding itself and a reviewer must be able to read it.
        if (String(outcome.detail).length > 400) {
          process.stdout.write(`  detail[${name}]: ${String(outcome.detail).replace(/\s+/g, ' ').trim()}\n`)
        }
      }

    const failBySkip = opts.full && counts.skip > 0
    printToken(counts.fail > 0 || failBySkip ? 'fail' : 'pass')
  }
  finally {
    if (!tokenPrinted) {
      printToken('fail', " harness=aborted detail=a leg threw past the per-leg catch; a run that never stated a verdict is a failure")
    }
  }

  return counts.fail > 0 || (opts.full && counts.skip > 0) ? 1 : 0
}

function git(args) {
  const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

// ───────────────────────────────────────────────────────────────────────────────── self-test ──

/**
 * Pinned verdict algebra, on synthetic inputs, in milliseconds. These are the cases a live run
 * cannot show you cheaply: the escalation (a red vanishing into a collection error), the
 * "counts moved but the set did not" case, and the missing-token rule. `--self-test` is the
 * leg-level guarantee that the ALGEBRA still bites between the expensive live controls.
 */
function selfTest() {
  const fails = []
  let ran = 0
  const ok = (cond, what) => {
    ran += 1
    if (!cond) fails.push(what)
  }

  const md = [
    '# POPULATION BASELINE',
    '## titled reds (file > full name), sorted:',
    'packages/a/test/x.test.ts > Suite the one that fails',
    'packages/a/test/y.test.ts > Suite two',
    '## collection-error files (a red that resolves into one of these is an ESCALATION, not a fix):',
    'packages/b/test/broken.test.ts',
    '## PUBLISHED CORRECTION (round 38) — the p6t1-parallel family note above was too comfortable',
    'packages/slow/test/slow.test.ts',
  ].join('\n')
  const base = parsePopulationBaseline(md)
  ok(base.ids.length === 3, 'baseline parses to 3 identities')
  ok(base.titledCount === 2 && base.collectionCount === 1, 'baseline splits titled vs collection')
  ok(base.flakyFamilyDisclosed === true, 'baseline tolerance authority detected from its prose')
  // The tolerance is READ FROM THE DOCUMENT. This is the pin against the first draft's defect,
  // which hardcoded one family: the day a second load-sensitive leg went red, a hardcoded list had
  // no way to know, and the only fix available to the author would have been to edit the gate —
  // i.e. to write one's own exemption.
  ok(base.loadFamilies.includes('p6t1-parallel'), 'a family named in prose ("the … family") is recognised')
  ok(base.loadFamilies.includes('packages/slow/test/slow.test.ts'), 'a path named in prose is recognised as a family file too')
  ok(!base.loadFamilies.includes('packages/a/test/x.test.ts'),
    'the IDENTITY LIST is not a family list — reading the debt section as a disclosure would excuse every baseline red at once')
  ok(parseLoadFamilies('# nothing\n## titled reds\npackages/a/test/x.test.ts > y\n## collection-error files:\npackages/b/test/broken.test.ts\n').length === 0,
    'a baseline that names no family excuses nothing (no prose, no tolerance, no re-sample)')
  ok(parseLoadFamilies(readFileSync(resolve(REPO_ROOT, BASELINES.census), 'utf8')).includes('p6t1-parallel'),
    `the family in force today is read from the committed baseline (${BASELINES.census}), not from a constant here`)

  // The LIVE reference, asserted against the LIVE document (the fixtures above prove grammar only).
  // The census leg grades against this file, so retargeting it has to break an assertion here — that
  // is the whole point of pinning it: nobody can widen or narrow what the gate excuses in prose.
  // loadFamilies is pinned too, because every word of that document outside its identity sections is
  // mined for family names, so a sentence added for the reader's benefit can silently grant an
  // exemption to a whole file. Re-derive all of these by running the capture command recorded in the
  // baseline document itself; never by editing this line to match what the last run printed.
  {
    const live = parsePopulationBaseline(readFileSync(resolve(REPO_ROOT, BASELINES.census), 'utf8'))
    ok(
      live.declaredTotals !== null
        && live.declaredTotals.files === 507 && live.declaredTotals.legs === 6355
        && live.ids.length === 9 && live.titledCount === 9 && live.collectionCount === 0
        && live.loadFamilies.length === 2,
      'the COMMITTED baseline parses to the corpus and tolerance it declares: 507/6355, 9 tolerated ids, 0 collection files, 2 disclosed load families (restated at b9cc0a2d: the D3-4 must-not-stay-exempt was repaired and its line removed, and the +1 leg is GREEN so it is not a tolerance)',
    )
  }

  let threw = false
  try {
    parsePopulationBaseline('# nothing here\n')
  }
  catch {
    threw = true
  }
  ok(threw, 'a baseline that parses to nothing REFUSES instead of passing')

  // Zero of a KIND is a legal state; zero of EVERYTHING is a changed document. Both are pinned,
  // because the first one is the case the old guard got wrong and the second is the case it got right.
  const zeroCollection = parsePopulationBaseline([
    '## titled reds (file > full name), sorted:',
    'packages/a/test/x.test.ts > Suite the one that fails',
    '## collection-error files (a red that resolves into one of these is an ESCALATION, not a fix):',
    '# NONE — every collection error in this corpus has been repaired.',
  ].join('\n'))
  ok(
    zeroCollection.ids.length === 1 && zeroCollection.collectionCount === 0,
    'ZERO collection files parses — repairing every collection error is expressible, not a refusal',
  )

  let threwRenamed = false
  try {
    parsePopulationBaseline('## titled red (renamed by mistake)\npackages/a/test/x.test.ts > S a red\n')
  }
  catch {
    threwRenamed = true
  }
  ok(
    threwRenamed,
    'a renamed identity-section header still REFUSES — the hazard the emptiness guard exists for',
  )

  // 1. counts moved, set identical → pass, and the move is stated.
  const moved = compareCensus(base.ids, [...base.ids].reverse(), { files: 999, legs: 12345, moved: true })
  ok(moved.verdict === 'pass' && moved.setIdentical, 'counts moved with an identical set ⇒ pass (identity sets, never totals)')

  // 1b. the baseline's OWN totals, newest-first across both spellings it uses.
  const withTotals = parsePopulationBaseline([
    '# POPULATION BASELINE',
    '# files 500 | registered legs 6262 | titled reds 19',
    '## titled reds (file > full name), sorted:',
    'packages/a/test/x.test.ts > Suite the one that fails',
    '## collection-error files (a red that resolves into one of these is an ESCALATION, not a fix):',
    'packages/b/test/broken.test.ts',
    '# RE-CONFIRMED: 502 files / 6277 registered legs / 19 titled reds',
    '## PUBLISHED CORRECTION (2026-10-08, round 38)',
    'Totals also move with merges: **505 files / 6285 legs / 19 titled reds by identity**.',
  ].join('\n'))
  // Left at 505/6285 ON PURPOSE: this is a GRAMMAR fixture, its numbers are its own, and what it
  // proves is that the newest occurrence wins across both spellings. On 2026-10-08, in the first
  // minute of retargeting the reference, this coordinator edited these numbers to the live corpus's
  // 507/6354 because a leg printed a different pair -- which does not update a pin, it deletes a
  // test. The live corpus is asserted against the live document further down, where it belongs.
  ok(
    withTotals.declaredTotals !== null && withTotals.declaredTotals.files === 505 && withTotals.declaredTotals.legs === 6285,
    'the NEWEST declared totals win across both spellings (505/6285, not the 500/6262 header)',
  )
  ok(
    withTotals.titledCount === 1 && withTotals.collectionCount === 1,
    'prose under a later level-2 heading is not read as an identity line',
  )

  // 2. a red vanishes into a collection error ⇒ ESCALATION, not a decrease.
  const escalated = compareCensus(base.ids, [
    'TEST packages/a/test/y.test.ts > Suite two',
    'FILE packages/b/test/broken.test.ts::COLLECTION-OR-UNHANDLED',
    'FILE packages/a/test/x.test.ts::COLLECTION-OR-UNHANDLED',
  ], {})
  ok(escalated.verdict === 'fail', 'a red that resolves into a collection error fails the leg')
  ok(escalated.escalations.some((e) => e.includes('packages/a/test/x.test.ts')), 'the escalation names the file')
  ok(escalated.resolved.includes('TEST packages/a/test/x.test.ts::Suite the one that fails'), 'the vanished red is also visible as "resolved" — the count went DOWN and it is still a fail')

  // 3. a genuinely new red ⇒ fail naming it.
  const newer = compareCensus(base.ids, [...base.ids, 'TEST packages/c/test/new.test.ts > A brand new failure'], {})
  ok(newer.verdict === 'fail' && newer.newReds.length === 1, 'a new red leg identity fails the census leg')

  // 4. debt removed ⇒ pass (the stage may remove baseline failures, never add any).
  const better = compareCensus(base.ids, base.ids.filter((id) => !id.endsWith('Suite two')), {})
  ok(better.verdict === 'pass' && better.resolved.length === 1, 'removing baseline debt passes')

  // 4b2. evidence filenames must survive pid reuse.
  ok(evidenceStamp('2026-10-08T13:20:31.412Z') === '20261008T132031Z', 'the stamp is filename-safe UTC seconds')
  ok(evidenceStamp('2026-10-08T13:20:31+02:00') === '20261008T132031Z', 'an offset stamp still lands filename-safe')
  ok(evidenceStamp('2026-10-08T13:20:31.412Z') !== evidenceStamp('2026-10-08T13:20:32.001Z'),
    'two runs one second apart get different artifact names — pids are reused across tool calls here, ' +
    'and two of this lane\'s own comparison sidecars overwrote each other before this existed')

  // 4c. the counts sentence must not contradict the set it is reporting on.
  const movedTotals = { moved: true, captured: '502f/6277l', declared: { files: 505, legs: 6285 } }
  ok(countsSentence(movedTotals, true).includes('COUNTS MOVED, SET DID NOT'),
    'counts moved over an unchanged set is stated as exactly that')
  ok(!countsSentence(movedTotals, false).includes('SET DID NOT'),
    'the same counts over a CHANGED set must not claim the set stood still — RED control D caught ' +
    'the first draft doing precisely that while naming an escalation in the same line')
  ok(countsSentence({ moved: false, captured: '505f/6288l', declared: { files: 505, legs: 6285 } }, true) === '',
    'no note when the counts match the document')

  // 5. the missing-token rule, in both directions.
  ok(checkTranscript('DSH-CI-LEG leg=typecheck verdict=pass seconds=1 detail=x\n').verdict === 'fail', 'no final token ⇒ fail, never not-run')
  ok(checkTranscript('DSH-CI-VERDICT pass pass=1 fail=0 skip=0 skipped=none legs=1\nDSH-CI-LEG leg=typecheck verdict=pass seconds=1\n').verdict === 'pass', 'a complete passing transcript passes')
  ok(checkTranscript('DSH-CI-LEG leg=a verdict=pass\nDSH-CI-LEG leg=b verdict=pass\nDSH-CI-VERDICT pass pass=2 fail=0 skip=0 skipped=none legs=2\n').verdict === 'pass', 'two-leg pass parses')
  ok(checkTranscript('DSH-CI-VERDICT pass pass=3 fail=0 skip=0 skipped=none legs=3\nDSH-CI-LEG leg=a verdict=pass\n').verdict === 'fail', 'a transcript that lost a leg line fails (the run stopped mid-leg)')
  ok(checkTranscript('DSH-CI-LEG leg=a verdict=fail\nDSH-CI-VERDICT pass pass=1 fail=0 skip=0 skipped=none legs=1\n').verdict === 'fail', 'a pass token over a failing leg fails the check')
  // …and the classes keep the two kinds of red apart: a gate that refused a tree is working, and a
  // transcript that cannot be graded is a broken instrument. Both exit 1; only one is a fault.
  ok(checkTranscript('DSH-CI-LEG leg=census verdict=fail\nDSH-CI-VERDICT fail pass=0 fail=1 skip=0 skipped=none legs=1\n').klass === 'red-run',
    'a faithful transcript of a RED run is classed red-run, not an instrument fault')
  ok(checkTranscript('nothing at all\n').klass === 'missing-token', 'silence is classed missing-token')
  ok(checkTranscript('DSH-CI-LEG leg=a verdict=pass\nDSH-CI-VERDICT pass pass=2 fail=0 skip=0 skipped=none legs=2\n').klass === 'truncated',
    'a lost leg line is classed truncated')
  ok(checkTranscript('DSH-CI-LEG leg=a verdict=pass\nDSH-CI-VERDICT pass pass=1 fail=0 skip=0 skipped=none legs=1\n').klass === 'ok',
    'a complete green transcript is classed ok')

  // 6. the fence classifier: silence and refusal are never clean.
  ok(classifyFenceReport('anything at all').verdict === 'fail', 'fence with no RESULT line is a failure')
  ok(classifyFenceReport('RESULT not-run :: cwd is not the repository toplevel').verdict === 'fail', 'fence refusal is a failure')
  const contradicting = classifyFenceReport('scanned-in-scope: 42 tracked files\nRESULT verdict: clean (dirty 0, unadjudicated unknown 0)\nRESULT dirty(3 files, 4 sites)')
  ok(contradicting.verdict === 'fail', 'a clean verdict contradicting its own counts is a failure')
  ok(contradicting.dirty?.files === 3 && contradicting.dirty?.sites === 4, 'the RESULT counts are PARSED, not defaulted — a fail that fires because the parse returned null is a right answer for the wrong reason')
  const cleanFence = classifyFenceReport([
    'scanned-in-scope: 42 tracked files',
    'RESULT dirty(0 files, 0 sites)',
    'RESULT unknown(0 files, 0 sites)',
    'RESULT verdict: clean (dirty 0, unadjudicated unknown 0)',
  ].join('\n'))
  ok(cleanFence.verdict === 'ran' && cleanFence.identities.length === 0, 'a clean fence at the toplevel is a run with an empty identity set')
  ok(cleanFence.scanned === 42 && cleanFence.dirty?.files === 0 && cleanFence.unknown?.files === 0, 'the clean case parses its universe and its counts (not just its verdict word)')

  // Refusal vocabulary: declared, undeclared, and lying in either direction.
  ok(
    applyRefusalPolicy('census', { verdict: 'refused', detail: 'x' }, ['census']).verdict === 'refused',
    'a refusal the invocation declared stays a refusal (and does not become a pass)',
  )
  const undeclaredRefusal = applyRefusalPolicy('census', { verdict: 'refused', detail: 'x' }, [])
  ok(
    undeclaredRefusal.verdict === 'fail' && undeclaredRefusal.detail.includes('--allow-refused census'),
    'an undeclared refusal is a fail that names the way out',
  )
  const refusalToken = finalToken('pass', {
    pass: 6,
    fail: 0,
    skip: 0,
    legs: 7,
    skipped: [],
    refused: 1,
    refusedList: ['census'],
  })
  ok(
    refusalToken.includes('refused=1') && refusalToken.includes('refusedlegs=census'),
    'the token states its refusals instead of hiding one inside pass=6 legs=7',
  )
  ok(
    finalToken('pass', { pass: 7, fail: 0, skip: 0, legs: 7, skipped: [] }).includes('refused=0 refusedlegs=none'),
    'a run with no refusal still states that field; absence is not a legacy transcript in disguise',
  )
  const trRefusedDeclared = checkTranscript(
    'DSH-CI-LEG leg=a verdict=pass\nDSH-CI-LEG leg=census verdict=refused\n' +
      'DSH-CI-VERDICT pass pass=1 fail=0 skip=0 skipped=none legs=2 refused=1 refusedlegs=census',
  )
  ok(
    trRefusedDeclared.verdict === 'pass' && trRefusedDeclared.klass === 'ok',
    'a declared refusal re-grades as a pass that says what it did not measure',
  )
  const trRefusedHidden = checkTranscript(
    'DSH-CI-LEG leg=a verdict=pass\nDSH-CI-LEG leg=census verdict=refused\n' +
      'DSH-CI-VERDICT pass pass=2 fail=0 skip=0 skipped=none legs=2 refused=0 refusedlegs=none',
  )
  ok(
    trRefusedHidden.verdict === 'fail' && trRefusedHidden.klass === 'undeclared-refusal',
    'a pass token carrying an undeclared refusal is refused by the re-grader — the same rule the run applies, from the outside',
  )
  const trRefusedPhantom = checkTranscript(
    'DSH-CI-LEG leg=a verdict=pass\nDSH-CI-VERDICT pass pass=1 fail=0 skip=0 skipped=none legs=1 refused=1 refusedlegs=census',
  )
  ok(
    trRefusedPhantom.verdict === 'fail' && trRefusedPhantom.klass === 'token-legs-disagree',
    'a declared refusal with no refusing leg is a token that lies',
  )

  ok(
    findContinuationComments('node gate.mjs --full \\\n  --a 1 \\\n  # why\n  --b 2 \\\n  | tee log').join(',') === '3',
    'a comment inside a backslash continuation is found, because it silently deletes every flag after it',
  )
  ok(
    findContinuationComments('# why\nnode gate.mjs --full \\\n  --a 1 \\\n  --b 2\n').length === 0,
    'a comment above the command is not an offence — the detector must not push comments into scripts',
  )
  ok(findContinuationComments('set -o pipefail\nmkdir -p x\nnode a.mjs --b\n').length === 0, 'a plain multi-line script reports nothing')

  const spGood = {
    graphText: 'current_phase: "PHASE — EXECUTION"\nstate_pointers:\n  round: 7\n  master_sha: abc1234\ns7_round6_records: x\ns7_round7_records: y',
    logText: '## 2026-10-07 round 6\nbody\n## 2026-10-08 round 7\nbody',
    isAncestor: () => true,
  }
  ok(checkStatePointers(spGood).findings.length === 0, 'a coherent pointer passes: round = newest record = last log heading, sha reachable')
  ok(
    checkStatePointers({ ...spGood, logText: '## 2026-10-08 round 6\nbody' }).findings.some((f) => f.includes('last SESSION_ROUTER_LOG heading')),
    'a graph updated without the log (or the reverse) fails — the recovery pair must move together',
  )
  ok(
    checkStatePointers({
      ...spGood,
      graphText: spGood.graphText.replace('current_phase: "PHASE — EXECUTION"', 'current_phase: "EXECUTION master = abc1234 (PR #65-#196 merged)"'),
    }).findings.some((f) => f.includes('embeds a master revision')),
    'the exact stale string this check was written for is illegal in current_phase, so the fix cannot rot back',
  )
  ok(
    checkStatePointers({ ...spGood, graphText: spGood.graphText.replace('  master_sha: abc1234\n', '') }).findings.some((f) => f.includes('master_sha missing')),
    'an absent graded field FAILS rather than passes — reformatting must not make the check vacuous',
  )
  ok(
    checkStatePointers({ ...spGood, isAncestor: () => false }).findings.some((f) => f.includes('not reachable from HEAD')),
    'a pointer naming an unreachable revision fails: it may lag, it may not invent',
  )
  ok(
    checkStatePointers({ ...spGood, graphText: spGood.graphText.replace('s7_round6_records: x', 's7_round5_records: x') }).findings.some((f) => f.includes('gaps at 6')),
    'a hole in the round numbering is reported, because a dropped record looks exactly like a skipped one',
  )
  ok(
    checkStatePointers({ ...spGood, graphText: spGood.graphText.replace('s7_round6_records: x\n', '').replace('s7_round7_records: y', 's7_round6_7_records: y') }).findings.length === 0,
    'one combined record node covering two rounds fills both — the real s7_round19_20_records node, which the first version of this leg wrongly called a gap',
  )

  for (const f of fails) process.stdout.write(`SELFTEST FAIL: ${f}\n`)
  process.stdout.write(
    fails.length === 0
      ? `DSH-CI-SELFTEST pass ${String(ran)} assertions (verdict algebra: identity sets, escalation, missing-token, fence refusal)\n`
      : `DSH-CI-SELFTEST fail ${String(fails.length)} of ${String(ran)}\n`,
  )
  return fails.length === 0 ? 0 : 1
}

// Only run when this file is the program, not when it is imported.
//
// This file exports its verdict algebra exactly so that other code can read it — `--self-test`, the
// tokenless-crash reproduction in evidence/, and anything else that wants to ask "what would this
// transcript score" without executing anything. The first draft ended in a bare
// `process.exit(main(process.argv.slice(2)))`, and an evidence script that imported the module for
// one pure function silently ran a seven-leg gate as a side effect of the import (which, among other
// things, raced the gate run already in flight and overwrote its leg captures — caught by doing it).
const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) process.exit(main(process.argv.slice(2)))
