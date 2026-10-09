/**
 * a4-client-lane-report.mjs — read the client lane's report machine-first (A4-PR7 G2).
 *
 * WHY THIS FILE EXISTS. The §7.6 merge-gate leg "the client lane runs, and no failure appears
 * outside the disclosed baseline" is the ONLY thing that runs the client suite (the root suite
 * cannot see `*.client.spec.*`), and it read the lane by matching human-facing vitest report
 * text with anchors that assume UNSTYLED bytes: `/^\s*(Test Files|Tests)\s/`, `/Tests\s+(\d+)
 * failed/`, `/^\s*FAIL\s+/`. On GitHub-hosted runners the very same vitest writes its summary
 * ANSI-coloured — the hosted capture of the failing run contains, byte for byte:
 *
 *   ESC[2m Test Files ESC[22m ESC[1mESC[31m5 failedESC[39mESC[22m…
 *
 * Against the parser as written: 0 lines match; after stripping ANSI: 2 do. A coloured summary
 * was therefore, to the instrument, literally NO summary, and the leg failed with "the client
 * lane produced no vitest summary at all" while the suite it inspects had printed a full report
 * (evidence: `dev/agent-workflow/evidence/a4-pr7/g2-summary-parser/`, hosted capture verbatim).
 * An instrument that cannot read the runner's own output is not a gate; it is a coin flip on
 * whether the child felt like colourising.
 *
 * THE ORDER OF SOURCES, and it is load-bearing:
 *  1. the vitest **JSON reporter** report (`--reporter=json --outputFile.json=…`), which is
 *     what the machine-facing contract looks like — this is the same pattern the root census
 *     already uses (`scripts/ci-pr-gate.mjs` census legs drive exactly those flags and grade
 *     from the JSON);
 *  2. the human text, ONLY as a fallback, and normalised before parsing: ANSI/escape sequences
 *     stripped, CRLF folded, an optional pnpm per-line prefix (`<dir> <script>: `) tolerated.
 *  A NO_COLOR/FORCE_COLOR=0 switch is NOT the fix: it is a mitigation in somebody else's child
 *  process, and the day that child colourises anyway the instrument is blind again in exactly
 *  this way. Styling may not change a verdict.
 *
 * WHAT THE CLASSIFIER MUST NEVER DO, restated here because both signs of the collapse have
 * already happened once in this phase:
 *  - treat a MISSING summary as green or even as anything other than a refusal (the hosted
 *    failure proves the refusal fires; the leg `refuses a capture with no summary` pins it);
 *  - treat an unparseable-but-present summary as "no summary at all" — the shape it saw must be
 *    named, or the next reader cannot tell truncation from colour from a hostile format;
 *  - accept a report that contradicts the process exit status (green report + nonzero exit is
 *    an unaccounted crash; red report + exit 0 is a lie about which one, and this file refuses
 *    to pick);
 *  - pass a FOURTH failure beyond the disclosed baseline — `outside` set by identity, from
 *    either source.
 */

/**
 * The client lane's disclosed pre-existing failures, by NAME, from
 * `dev/agent-workflow/evidence/a4-client-baseline/README.md` (identical at `11e1609c` and
 * `d21effba`, i.e. pre-Alpha.4). Matching is by file + title: a renamed test inside these files
 * fails the gate and forces the baseline record to be updated on purpose. Moved out of the test
 * file verbatim (origin/master `a4p7-merge-gate.test.ts:93-97`) so a plain-Node witness and the
 * suite share ONE baseline list.
 */
export const CLIENT_BASELINE_FAILURES = Object.freeze([
  'test/team-creation-panel.client.spec.tsx > TeamCreationPanel > selecting a blueprint loads the detail block and fires the persona-fact probe (S5-A, UI §6/§7)',
  'test/team-creation-panel.client.spec.tsx > TeamCreationPanel > switching the runtime preset re-runs the probe with the new persona fact (UI §7.3)',
  'test/team-governance.client.spec.tsx > TeamGovernance > an override reset targets the member instance (scope instance) and pulls once on success',
])

/** Disclosed separately: location-dependent (its import climbs five directories), see the README. */
export const CLIENT_DISCLOSED_LOCATION_DEPENDENT = 'test/s3-client-generation-spike.test.ts'

/** The spec FILES the disclosed trio lives in, derived from the names above. */
export const CLIENT_TRIO_FILES = Object.freeze([
  ...new Set(CLIENT_BASELINE_FAILURES.map((name) => (name.split(' > ')[0] ?? '').replace(/^test\//, ''))),
])

/**
 * Remove terminal escape sequences (CSI, OSC with BEL/ST terminator, and two-char escapes).
 * SGR (`ESC[…m`) is what vitest writes today; the broader set is deliberate — a cursor move or
 * an OSC-8 hyperlink in the same stream must not be able to re-introduce the G2 blindness either.
 */
export function stripAnsi(text) {
  return String(text).replace(
    // eslint-disable-next-line no-control-regex -- reading a terminal stream IS the job
    /[\u001B\u009B](?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001B]*(?:\u0007|\u001B\\)|[@-Z\\-_])/g,
    '',
  )
}

/**
 * pnpm may print `packages/client test:  Test Files …`. Tolerating the prefix means removing
 * EXACTLY the prefix, keeping the leading spaces that are part of vitest's own alignment and
 * the anchor's expectation.
 */
const PNPM_LINE_PREFIX = /^(\s*)(?:[\w.@/~+-]+ [\w.:-]+:\s)/
function lineBody(line) {
  const m = PNPM_LINE_PREFIX.exec(line)
  return m === null ? line : `${m[1]}${line.slice(m[0].length)}`
}

function tailOf(text, lines = 6) {
  const kept = stripAnsi(String(text)).trimEnd().split('\n').filter((l) => l.length > 0)
  return kept.slice(-lines).join('\n      ')
}

function isDisclosedIdentity(identity) {
  return CLIENT_BASELINE_FAILURES.some((b) => identity.startsWith(b)) || identity.startsWith(CLIENT_DISCLOSED_LOCATION_DEPENDENT)
}

function missingTrioWhy(missing) {
  return (
    `${String(missing.length)} of the ${String(CLIENT_TRIO_FILES.length)} files the disclosed client baseline lives in is not in ` +
    `packages/client/test (${missing.join(', ')}) — a test that is not in the tree cannot fail, so a zero-failure ` +
    `report from this lane measures nothing. §7.6 closes ON the three named failures; if they were fixed or the files renamed, ` +
    `update dev/agent-workflow/evidence/a4-client-baseline/README.md and the gate's CLIENT_BASELINE_FAILURES in the same change ` +
    `rather than letting the absence pass as a green.`
  )
}

/** `test/x.spec.tsx` from whatever path shape the reporter used (absolute, repo-relative, pkg-relative). */
function clientRelativePath(name) {
  const p = String(name).replace(/\\/g, '/')
  const pkg = /(?:^|\/)packages\/client\/(.+)$/.exec(p)
  if (pkg?.[1] !== undefined) return pkg[1]
  const test = /(?:^|\/)(test\/.+)$/.exec(p)
  if (test?.[1] !== undefined) return test[1]
  return p
}

/**
 * Parse a vitest JSON reporter report into the lane's FAILING IDENTITIES. An identity has the
 * `file > suite > test` shape the disclosed baseline is written in, rebuilt from
 * `testResults[].name` + `ancestorTitles` + `title` (the reporter's own `fullName` is a jest-style
 * SPACE-joined string and must not be trusted as an identity). A file that failed as a whole —
 * a collection error, the shape the location-dependent s3 spike produces — yields the file path
 * itself, which is what the text FAIL line printed for it and what the disclosed s3 prefix matches.
 */
function parseJsonReport(jsonText) {
  let doc
  try {
    doc = JSON.parse(jsonText)
  } catch (e) {
    return { ok: false, why: `the client lane's JSON report file existed but is not parseable JSON (${String(e).split('\n')[0]})` }
  }
  if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.testResults) || typeof doc.numFailedTests !== 'number') {
    return { ok: false, why: 'the client lane\'s JSON report lacks the fields the vitest json reporter publishes (testResults[], numFailedTests) — it is not a report this reader knows' }
  }
  const identities = []
  let assertionFailures = 0
  for (const file of doc.testResults) {
    if (file === null || typeof file !== 'object') continue
    const rel = clientRelativePath(file.name ?? '')
    const assertions = Array.isArray(file.assertionResults) ? file.assertionResults : []
    let failedHere = 0
    for (const a of assertions) {
      if (a?.status === 'failed') {
        failedHere += 1
        const titles = Array.isArray(a.ancestorTitles) ? a.ancestorTitles.filter((t) => typeof t === 'string' && t.length > 0) : []
        identities.push([rel, ...titles, typeof a.title === 'string' ? a.title : '(unnamed test)'].join(' > '))
      }
    }
    assertionFailures += failedHere
    if (file.status === 'failed' && failedHere === 0) identities.push(rel)
  }
  if (assertionFailures !== doc.numFailedTests) {
    return {
      ok: false,
      why: `the client lane's JSON report contradicts itself: numFailedTests=${String(doc.numFailedTests)} but ${String(assertionFailures)} failed assertions in testResults — a half-written or truncated report is not a verdict`,
    }
  }
  return {
    ok: true,
    identities,
    failed: doc.numFailedTests,
    passed: typeof doc.numPassedTests === 'number' ? doc.numPassedTests : null,
    total: typeof doc.numTotalTests === 'number' ? doc.numTotalTests : null,
    success: doc.success === true,
  }
}

const SUMMARY_LABEL = /^\s*(Test Files|Tests)\s+(.*)$/
const FAIL_LINE = /^\s*FAIL\s+(.+)$/
const COUNT_TOKEN = /([\d,]+)\s+(passed|failed|skipped|todo)/g

/** The text (human report) path: normalise FIRST — ANSI stripped, CRLF folded, pnpm prefixes tolerated. */
function parseTextReport(rawText) {
  const flat = stripAnsi(String(rawText)).replace(/\r\n?/g, '\n')
  const lines = flat.split('\n').map(lineBody)
  const summary = []
  const identities = []
  for (const line of lines) {
    const s = SUMMARY_LABEL.exec(line)
    if (s !== null) summary.push({ label: s[1], content: s[2], shape: line.trim() })
    const f = FAIL_LINE.exec(line)
    if (f !== null) identities.push(f[1].trim())
  }
  const counts = new Map()
  for (const m of (summary.find((x) => x.label === 'Tests')?.content ?? '').matchAll(COUNT_TOKEN)) {
    if (!counts.has(m[2])) counts.set(m[2], Number(m[1].replace(/,/g, '')))
  }
  return { flat, summary, identities, counts }
}

/**
 * Measure, not infer, what the child stream looked like. This exists because the G2 failure
 * text reported "no vitest summary at all" about output that contained three summaries —
 * the instrument asserted absence when it had failed to read presence. `observed` is computed
 * from the INPUT independently of which grading branch ran, so it is a measurement the reader
 * can cross-check against `why`: if the two ever disagree, that disagreement is itself the bug.
 * ANSI here is an ESC-OCCURRENCE count (a lower bound on styled bytes; one ESC introduces one
 * escape sequence). The colour TRIGGER is deliberately nowhere in this file: what colours the
 * child is the child's business — see FINDINGS.md for the measured boundary.
 */
function observeRun(run) {
  const out = run.out ?? ''
  // eslint-disable-next-line no-control-regex -- counting ESC occurrences IS the measurement
  const escBytes = (out.match(/\u001B/g) ?? []).length
  const jsonText = run.jsonText ?? null
  const json = jsonText !== null && jsonText.trim().length > 0 ? parseJsonReport(jsonText) : null
  const text = parseTextReport(out)
  let source
  if (json !== null && json.ok) {
    source = 'the vitest JSON report'
  } else if (text.summary.length > 0) {
    source = `the ANSI-stripped text stream (${json === null ? 'no JSON report was written' : 'the JSON file existed but was not a report this reader knows'}; ${String(text.summary.length)} summary line(s) seen)`
  } else {
    source = `nothing readable (${json === null ? 'no JSON report was written' : 'the JSON file was not a report this reader knows'}; the text stream carried no summary line)`
  }
  const identities = json !== null && json.ok ? json.identities.length : text.identities.length
  return `parsed ${String(identities)} failing identities from ${source}; child stdout contained ANSI: ${escBytes > 0 ? `yes(${String(escBytes)} ESC bytes)` : 'no'}`
}

/**
 * Classify one client-lane run.
 *
 * @param run {{
 *   out?: string,                    // child stdout+stderr, verbatim (styling and all)
 *   jsonText?: string | null,        // content of the --outputFile.json report, null when absent
 *   code?: number | null,            // the process exit status; null/undefined = not observed
 *   missingTrioFiles?: readonly string[],  // trio spec files absent from the tree (listed BEFORE the run)
 * }}
 * @returns {{ verdict: 'passed' | 'failed' | 'refused', why: string, observed: string }}
 */
export function classifyClientLaneReport(run) {
  const r = gradeClientLaneRun(run)
  return { ...r, observed: observeRun(run) }
}

function gradeClientLaneRun(run) {
  const out = run.out ?? ''
  const missing = run.missingTrioFiles ?? []
  const code = run.code ?? null

  // 1. The machine-readable source. Absent or unreadable JSON does NOT decide anything — it
  //    degrades to the text fallback while keeping its complaint visible in the refusal text.
  let jsonProblem = null
  let json = null
  const jsonText = run.jsonText ?? null
  if (jsonText === null) {
    jsonProblem = 'no JSON report file was written'
  } else if (jsonText.trim().length === 0) {
    jsonProblem = 'the JSON report file was empty'
  } else {
    const parsed = parseJsonReport(jsonText)
    if (parsed.ok) json = parsed
    else jsonProblem = parsed.why
  }

  if (json !== null) {
    const exitSaysSuccess = code === 0
    if (code !== null && json.success !== exitSaysSuccess) {
      return {
        verdict: 'refused',
        why:
          `the client lane's JSON report (success: ${String(json.success)}, ${String(json.failed)} failed of ${String(json.total)}) ` +
          `contradicts its exit status (${String(code)}) — a report and an exit code that disagree cannot be read as either ` +
          `a pass or a named failure; one of them is lying about the run`,
      }
    }
    const outside = json.identities.filter((id) => !isDisclosedIdentity(id))
    if (outside.length > 0) {
      return { verdict: 'failed', why: `new client-lane failures outside the disclosed baseline: ${outside.slice(0, 5).join(' | ')}` }
    }
    if (missing.length > 0) return { verdict: 'failed', why: missingTrioWhy(missing) }
    const matched = CLIENT_BASELINE_FAILURES.filter((b) => json.identities.some((id) => id.startsWith(b)))
    if (json.failed > 0 && matched.length === 0) {
      return {
        verdict: 'failed',
        why:
          `${String(json.failed)} client-lane failure(s) reported and NONE matched the disclosed names — the baseline record in ` +
          `a4-client-baseline/README.md has drifted and must be re-derived, not re-pinned silently: ${json.identities.slice(0, 5).join(' | ')}`,
      }
    }
    return {
      verdict: 'passed',
      why:
        `machine-readable (vitest JSON reporter): ${String(json.failed)} failed of ${String(json.total)} tests across ` +
        `${String(json.identities.length)} disclosed failing identit${json.identities.length === 1 ? 'y' : 'ies'}, exit ${String(code)}; ` +
        `${String(matched.length)} of the baseline trio matched by name${json.failed === 0 ? '; the trio is GREEN, which §7.6 allows because the files are there to be re-run' : ''} ` +
        `(the s3 spike is location-dependent, see a4-client-baseline/README.md)`,
    }
  }

  // 2. The text fallback — only after the machine-readable source is gone, and normalised
  //    first: what is parsed is the STRIPPED text, so styling cannot change a verdict.
  const text = parseTextReport(out)
  if (text.summary.length === 0) {
    return {
      verdict: 'refused',
      why: `the client lane produced no vitest summary at all (${jsonProblem}; tail: ${tailOf(out)})`,
    }
  }
  const testsLine = [...text.summary].reverse().find((s) => s.label === 'Tests')
  if (testsLine === undefined) {
    return {
      verdict: 'refused',
      why:
        `the client lane's summary is present but incomplete: a \`Test Files\` line was seen ` +
        `(${String(text.summary.length)} summary line(s), e.g. \`${text.summary[0]?.shape ?? ''}\`) with no \`Tests\` line, ` +
        `so the failing-test count cannot be read (${jsonProblem})`,
    }
  }
  if (text.counts.size === 0) {
    return {
      verdict: 'refused',
      why:
        `the client lane's summary line exists but nothing in it reads as a count — the shape seen: ` +
        `\`${testsLine.shape}\` (a count token is e.g. "3 failed | 877 passed (880)"; "no tests", truncation, ` +
        `or a format this reader does not know all land here — this is deliberately NOT the "no summary at all" ` +
        `answer, because the summary exists and the instrument must say what it saw) (${jsonProblem})`,
    }
  }
  const failed = text.counts.get('failed') ?? 0
  if (code !== null && failed === 0 && code !== 0) {
    return {
      verdict: 'refused',
      why:
        `the text summary reports zero failures yet the lane exited ${String(code)} — something the report does not account ` +
        `for went down (an unhandled error, a crashed teardown, the OOM killer); an exit status this summary cannot ` +
        `explain is not a pass (${jsonProblem})`,
    }
  }
  if (code !== null && failed > 0 && code === 0) {
    return {
      verdict: 'refused',
      why:
        `the text summary reports ${String(failed)} failures yet the lane exited 0 — a report and an exit code that ` +
        `disagree cannot be read as a verdict (${jsonProblem})`,
    }
  }
  const outside = text.identities.filter((id) => !isDisclosedIdentity(id))
  if (outside.length > 0) {
    return { verdict: 'failed', why: `new client-lane failures outside the disclosed baseline: ${outside.slice(0, 5).join(' | ')}` }
  }
  if (missing.length > 0) return { verdict: 'failed', why: missingTrioWhy(missing) }
  const matched = CLIENT_BASELINE_FAILURES.filter((b) => text.flat.includes(b))
  if (failed > 0 && matched.length === 0) {
    return {
      verdict: 'failed',
      why:
        `${String(failed)} client-lane failure(s) reported and NONE matched the disclosed names — the baseline record in ` +
        `a4-client-baseline/README.md has drifted and must be re-derived, not re-pinned silently: ${text.identities.slice(0, 5).join(' | ')}`,
    }
  }
  return {
    verdict: 'passed',
    why:
      `fallback text (ANSI-stripped, pnpm prefixes tolerated) after ${jsonProblem}: ` +
      `${text.summary.map((s) => s.shape).join(' / ')} — every reported failure is disclosed, the trio's ` +
      `${String(CLIENT_TRIO_FILES.length)} spec files are present, and ${String(matched.length)} of the baseline trio matched by name` +
      `${failed === 0 ? '; the trio is GREEN, which §7.6 allows because the files are there to be re-run' : ''} ` +
      `(the s3 spike is location-dependent, see a4-client-baseline/README.md)`,
  }
}
