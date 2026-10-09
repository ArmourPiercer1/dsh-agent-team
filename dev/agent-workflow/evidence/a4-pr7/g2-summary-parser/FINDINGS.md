# G2 — the merge gate's client-lane leg was colour-blind (CI integrity, 2026-10-09)

## What the hosted runner said, and what it meant

On GitHub runners `a4p7-merge-gate.test.ts` §7.6 failed. The assertion line, verbatim from
the census capture (`fixtures/hosted-census-capture-1.raw.txt:1605`, ESC bytes shown by `cat -v`):

```
^[[31m^[[1mAssertionError^[[22m: client lane did not close. why: the client lane produced no vitest summary at all; tail:     ^[[90m391|^[[31m         blueprintRevision^[[33m:^[[31m ^[[34m2^[[31m^[[33m,^[[31m
```

Both census captures agree (`hosted/a1-census-run.txt`, `hosted/a2-census-run.txt` — identical
identity sets, this leg the *only* new red in either run). Locally the same suite is green
(29 tests, 92.7 s; client leg 12.5 s). The cause is not the client lane and not any clock: it
is the **parser**. On hosted the summary vitest prints is ANSI-styled —

```
^[[2m Test Files ^[[22m ^[[1m^[[31m5 failed^[[39m^[[22m^[[2m | ^[[22m^[[1m^[[32m503 passed^[[39m^[[22m^[[90m (508)^[[39m
```

— while origin/master's anchors (`/^\s*(Test Files|Tests)\s/`, `/Tests\s+(\d+) failed/`,
`/^\s*FAIL\s+(.+)$/`, the `out.includes(name)` trio test) assume unstyled text. Against the
hosted bytes: **0 lines** match as written, **2** after ANSI strip. Same for `reportedFailures`
and the FAIL-identity extraction. Absence of *style* was being read as absence of *evidence* —
which is why the refusal said "no summary at all" about a capture containing three summaries,
and why the prior misdiagnosis reached for `--census-test-timeout 20000→90000`.

The styled/unstyled boundary is now measured on both sides of it, same instrument (the census
leg), same flags, piped output both times — the coordinator's pair:

* local `dev/agent-workflow/evidence/a4-pr7/ci-gate/transcripts-green-run1-found-F1/first/census-capture-1.txt` — **0 ESC bytes**;
* hosted run 37814101108 `census-transcripts/census-capture-1.txt` — **1290 ESC-bearing lines, 9036 ESC bytes**, same line rendered `^[[2m Test Files ^[[22m ^[[1m^[[31m5 failed…`.

## Why the runner styles and this box does not — BOUNDED, not explained

**The trigger on the runner is not identified and this lane does not claim it is.** An earlier
draft of this file blamed tinyrainbow's `CI`/`TERM` rule; that causal story is withdrawn —
written here as what was measured instead (transcript `06-colour-matrix.txt`, all runs piped):

* While `NO_COLOR` is exported — **this harness exports `NO_COLOR=1` and `TERM=dumb` by
  default** — the summary stays unstyled through a pipe *even under `FORCE_COLOR=1` and even
  with `TERM=xterm`*. That is the local accident that hid this bug for a census cycle: the
  lane "happened to be" green locally.
* Remove `NO_COLOR` and the same command styles the summary through the same pipe whatever
  else is set — `TERM=dumb` included, `FORCE_COLOR` not even needed.
* The reproduction attempts made from this sandbox (`CI=true TERM=xterm`, `+FORCE_COLOR=1`,
  `VITEST_COLORS=1`) print plain **because the shell keeps exporting `NO_COLOR=1`**, which
  measured dominant; a negative local repro therefore proves nothing about the runner. The
  identical repro shapes with `NO_COLOR` removed print styled.

What is known: the runner emitted 9036 ESC bytes across 1290 lines through a pipe; this box emits 0 while
  (A correction dated 2026-10-09: the coordinator's original figure of 1290 was the count of
   ESC-BEARING LINES from `grep -c`, not bytes; the byte count is 9036. Local is 0 either way.
   The unit was wrong because the instrument that counted it was never checked against the
   claim being made -- grep -c counts lines.)

`NO_COLOR` suppresses and styles the instant it does not. What is NOT known: which variables
the runner exports — never observed from here. **That is precisely why the fix cannot depend
on the trigger**: the parser grades the hosted bytes themselves, is colour-independent by
construction, and the leg now *reports* its ANSI measurement beside every verdict. The forced-
colour reproduction used in transcript 03 (`env -u NO_COLOR -u TERM FORCE_COLOR=1`) is
therefore a byte-generator for the property test, not a claim about the runner. No
`NO_COLOR`/`FORCE_COLOR` flag is set anywhere in the build or the gate.

## The fix (branch `fix/a4-g2-summary-parser`)

`scripts/a4-client-lane-report.mjs` (+ `.d.mts`) — the classifier, extracted so the red/green
witnesses can grade the same bytes outside vitest. The test leg now drives the lane with
`--reporter=default --reporter=json --outputFile.json=…` (the same flags the root census
already uses, `scripts/ci-pr-gate.mjs:901`) and grades the **JSON report first**:

* identity = `file-relative-path > ancestorTitles > title` (never `fullName`, which is
  space-joined and loses the `>` separator);
* a file that failed with zero failed assertions is a **collection error** and yields its
  relative path as the identity — that is how the disclosed location-dependent
  `test/s3-client-generation-spike.test.ts` appears in JSON;
* internal incoherence (`assertionFailures ≠ numFailedTests`) and any JSON-vs-exit-status
  contradiction are **refused**, not averaged;
* outside→failure set, missing-trio-file, and "JSON says failures but nothing matched the
  disclosed names" remain the three `failed` refusals they were.

The text stream is the **fallback**, normalised before parsing: ANSI CSI/OSC stripped, CRLF
folded, pnpm/vite line prefixes (`pkg test:` / `$ cmd`) tolerated, summary counts parsed from
count *tokens* rather than absolute column anchors, and the child's **exit status is part of
the report** (a green summary under a nonzero exit is an unaccounted crash → refused; the
`exited N` wording says so).

Preserved, and now pinned by name: missing summary still says **"no vitest summary at all"**
and is refused; a fourth failure outside the disclosed trio is still refused **by name**; new:
a summary that exists but cannot be parsed names the shape it saw
(`the client lane's summary line exists but nothing in it reads as a count — the shape seen:
…`) instead of claiming absence — the two facts must not share a message, because conflating
them is what pointed the coordinator at clocks.

### The instrument now reports what it measured

Every verdict carries an `observed` line beside `why`, computed from the input independently
of which grading branch ran — identities parsed, from which source, and an ANSI count:

```
observed: parsed 3 failing identities from the ANSI-stripped text stream (no JSON report was
written; 2 summary line(s) seen); child stdout contained ANSI: yes(1320 ESC bytes)
```

The §7.6 failure text prints it next to the verdict. G2's actual lie was an absence claim
made over presence; from now on the absence claim (`the text stream carried no summary line`)
is *backed by the same measurement*, and the two sentences can disagree out loud if they ever
should. The "missing summary is a refusal" rule is unchanged.

## Red → green on the same bytes

* `transcripts/01-red-origin-master-parser-on-hosted-bytes.txt` — the verbatim origin/master
  copy of the test file plus `witness-block.ts`, run under vitest (`-t witness:`):
  **6 failed / 1 passed / 29 skipped**. The coloured trio, the hosted capture, the fourth
  failure, the unparseable summary, JSON-first, and exit-cross-check all red; the one green
  is the no-summary refusal the old parser already got right (kept green deliberately).
  The hosted capture grades as *"the client lane produced no vitest summary at all; tail: …"*
  — the hosted failure reproduced off-GitHub.
* `transcripts/02-green-shipped-parser-on-same-bytes.txt` — `node parse-hosted-bytes.mjs`,
  the shipped parser on the same fixture bytes: all 8 expectations met,
  `style-independence: coloured=passed plain=passed AGREE`, exit 0.
* `transcripts/03-client-lane-forced-colour.txt` — the client lane run with colour forced on
  (see bounded section above): 181 ESC-bearing lines, exit 1, three red tests = the disclosed
  trio; graded `passed` from JSON and, with JSON withheld, from the coloured text alone. Old
  anchor on these bytes: 0 matching lines; shipped parser: passed.
* `transcripts/04-merge-gate-suite.txt`, `05-testkit-dir.txt` — the suites green.
* `transcripts/06-colour-matrix.txt` — the NO_COLOR/TERM/FORCE_COLOR matrix, including the
  coordinator's repro shapes with and without `NO_COLOR`.

## Fixture provenance (what is hosted-verbatim and what is assembled)

| file | provenance |
| --- | --- |
| `fixtures/hosted-census-capture-1.raw.txt` | **verbatim** GitHub-runner capture (coordinator artifact `hosted/a1-census-run.txt`'s capture-1, 200635 B; `hosted/a1-census-run.txt`/`a2` are the census wrappers). All ANSI hosted bytes. |
| `fixtures/client-lane-forced-colour.raw.txt` | **verbatim local capture of the real client lane**, colour forced (`env -u NO_COLOR -u TERM FORCE_COLOR=1 pnpm --filter ./packages/client run test --reporter=default --reporter=json --outputFile.json=…`), exit 1. Produced on this branch's worktree; byte shape matches hosted (`^[[2m Test Files ^[[22m…`, `^[[41m^[[1m FAIL ^[[22m^[[49m test/…^[[2m > ^[[22m…`). |
| `fixtures/client-lane-report.sample.json` | **verbatim** vitest JSON report of that same forced-colour run (`numFailedTests:3 / 880`, the trio by file+title). |
| `fixtures/client-lane-coloured-trio.raw.txt` | **assembled** by `make-fixtures.mjs` from the hosted capture: the team-governance FAIL line is a hosted-verbatim line (indent preserved); the two team-creation-panel FAIL lines use the hosted token sequence (`^[[41m^[[1m FAIL ^[[22m^[[49m ` + `^[[2m > ^[[22m` separators) with byte-exact identities, and the summary lines are the hosted summary lines with only the counts swapped to the client lane's true numbers (2 failed/53 passed (55); 3 failed/877 passed (880)). The hosted capture carries nested child FAIL text only for team-governance (its tail-25 window), so the nested lines of the other file are not reproduced here. |
| `fixtures/client-lane-coloured-fourth-failure.raw.txt` | the trio fixture + one **synthesised** fourth failure (`test/whatever-broke-next.client.spec.tsx > WhateverBrokeNext > …`), counts updated to match. Explicitly a synthetic probe of the refusal, not a captured run. |
| `fixtures/client-lane-plain-trio.raw.txt` | the trio fixture with ANSI stripped — the "same bytes unstyled" twin used to prove the verdict does not move with styling. |
| `fixtures/client-lane-no-summary.raw.txt` | **assembled**: RUN header + progress lines (shapes from the hosted capture) then `ELIFECYCLE Command failed with exit code 137.` — a lane killed before summarising. No summary lines by construction. |
| `fixtures/client-lane-summary-unparseable.raw.txt` | **assembled**: hosted-shaped summary lines whose counts are replaced (`unknown … truncated …` / ` ??? ??? ??? `) to probe "summary exists, counts do not parse". |

`make-fixtures.mjs` is deterministic (hosted file → fixtures), asserts every hosted fragment it
uses is actually present in the capture before splicing it, and writes UTF-8.

## Same-disease audit (who else parses human output assuming unstyled text)

Grep over tracked instruments for `Test Files|Tests`, `^FAIL `, `/^\s*✓/` and friends:

**Exposed to child styling, read as text (the G2 disease):**
1. `packages/testkit/test/a4p7-merge-gate.test.ts` §7.6 client-lane leg — **fixed here**
   (JSON first, ANSI-stripping fallback, exit cross-checked, styling reported).
2. same file, the typecheck leg (`pnpm -r typecheck`): greps `error TS` substrings and
   `` `${pkg} typecheck: Done` `` from pnpm/tsc children — both are styleable. **Left
   unfixed**: not what this change requires; it is green on both hosted runs (the styling that
   actually appears does not break these anchors — pnpm colour-wraps segments around, not
   inside, the contiguous `typecheck: Done` span, and `error TS` appears unbroken), and
   rewriting a second leg's contract is a separate change. Flagged for follow-up with the
   same treatment (exit-code-first, or tolerant parse + measurement).

**Machine-readable already (safe):** root census legs in `scripts/ci-pr-gate.mjs` and
`scripts/fail-set.mjs` — consume vitest's JSON report (`--reporter=json`), never the text;
the lint-identities leg grades by **exit code** + its own script's plain stdout
(`baseline …` line, indented stderr identities — `lint-identities.mjs` emits no ANSI);
`check-artifacts-at-head.mjs` / `check-artifacts-committed.mjs` parse their own
`DSH-ARTIFACT-VERDICT k=v` lines (key=value, own emitter, no ANSI);
`composition-smoke.mjs` PASS/FAIL/SKIP arms and `verify-blueprint-version-clean.mjs`
`RESULT …` lines are own-script plain `console.log` output, parsed by the merge gate's
classifiers.

**Produces, not parses:** `scripts/run-tests.mjs` prints `✗` lines itself; dozens of
`dev/agent-workflow/evidence/**` shell greps are historical one-shot operator scratch, not
gates (they read local transcripts captured unstyled).

## Not verifiable here, stated plainly

* **What the runner exports.** Never observed from this sandbox; the colour trigger on hosted
  is unidentified (see the bounded section). The fix does not lean on it. A `env | grep -iE
  'color|term|ci'` step in the workflow would settle it, but touching `.github/workflows/*`
  is outside this lane — flagged, not done.
* The location-dependent s3 spike's JSON shape **on hosted** (collection error, so identity =
  file path): the classifier handles both shapes and the disclosed baseline README covers it,
  but the only hosted capture available contains no client-lane JSON (the census JSON is the
  root suite's).
* Whether the trio's two team-creation-panel FAIL lines look byte-identical on hosted: the
  census tail-25 window only captured team-governance's failure block; the coloured fixture
  rebuilds them from the hosted token sequence + exact identities, and the forced-colour
  capture independently confirms this shape is what vitest 4.1.11 actually emits.
