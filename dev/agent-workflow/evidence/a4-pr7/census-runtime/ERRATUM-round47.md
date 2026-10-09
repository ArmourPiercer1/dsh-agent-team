# ERRATUM evidence — read off the uploaded artifacts, not off a summary

Source: `gh run download` of the two `census-runtime-transcripts-*` artifacts of PR #219, runs
`37814101108` (clock 20000) and `37815648878` (clock 90000). Everything below is generated from those
bytes; ANSI is stripped only where marked, and the stripping is itself one of the measurements.

## run 37814101108 (clock 20000)

- leg line: `DSH-CI-LEG leg=census verdict=fail seconds=358.9`
- every `NEW RED(S)` line in `census-run.txt`, verbatim (ANSI stripped):
  - `DSH-CI-LEG leg=census verdict=fail seconds=358.9 detail=roots: nine (packages/*/test) via the root vitest config; baseline dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md = 9 titled reds`
  - `detail[census]: roots: nine (packages/*/test) via the root vitest config; baseline dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md = 9 titled reds + 0 collection files; captured 508f/637`
  - capture 1, S13: `✓ S13 file aliases, quoted values, and capture formats pass the standalone regressions  1938ms`
  - capture 1, failure: `AssertionError: client lane did not close. why: the client lane produced no vitest summary at all; tail:     391|         blueprintRevision: 2,`
  - capture 2, S13: `✓ S13 file aliases, quoted values, and capture formats pass the standalone regressions  1967ms`
  - capture 2, failure: `AssertionError: client lane did not close. why: the client lane produced no vitest summary at all; tail:     391|         blueprintRevision: 2,`

## run 37815648878 (clock 90000)

- leg line: `DSH-CI-LEG leg=census verdict=fail seconds=461.6`
- every `NEW RED(S)` line in `census-run.txt`, verbatim (ANSI stripped):
  - `DSH-CI-LEG leg=census verdict=fail seconds=461.6 detail=roots: nine (packages/*/test) via the root vitest config; baseline dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md = 9 titled reds`
  - `detail[census]: roots: nine (packages/*/test) via the root vitest config; baseline dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md = 9 titled reds + 0 collection files; captured 508f/637`
  - capture 1, S13: `✓ S13 file aliases, quoted values, and capture formats pass the standalone regressions  2827ms`
  - capture 1, failure: `AssertionError: client lane did not close. why: the client lane produced no vitest summary at all; tail:     391|         blueprintRevision: 2,`
  - capture 2, S13: `✓ S13 file aliases, quoted values, and capture formats pass the standalone regressions  2459ms`
  - capture 2, failure: `AssertionError: client lane did not close. why: the client lane produced no vitest summary at all; tail:     391|         blueprintRevision: 2,`

## the parsing measurement (G2), on run 37814101108 capture 1

- lines matching `/^\s*(Test Files|Tests)\s/` **as written**: 0
- the same regex after stripping ANSI: 2
- the summary line as the runner wrote it (`ESC` shown as `^[`):

```
  ^[[2m Test Files ^[[22m ^[[1m^[[31m5 failed^[[39m^[[22m^[[2m | ^[[22m^[[1m^[[32m503 passed^[[39m^[[22m^[[90m (508)^[[39m
```

## how the false record was produced, exactly

`census-run.txt` contains **two** `NEW RED(S) 1:` lines: a per-capture one rendered short — it ends at
`TEST packages/testkit` — and a union-grade one carrying the full identity
(`…/a4p7-merge-gate.test.ts::A4-PR7 §7.6 … the client lane …`). The coordinator read the first and
stopped, then supplied the missing identity from a neighbouring fact (another lane's LOCAL red on
`rc2-sanitize-evidence`, whose leg declares a 60 s budget). The complete identity was in the same file,
a few lines away. A truncated line is not a measurement, and reading the first match of a repeated
label is not reading the artifact.

## what this proves, and what it does not

Proves: `S13` passed in every capture of both hosted runs; both runs were blocked by the SAME
`a4p7-merge-gate` client-lane identity reporting `no vitest summary at all`; and that a coloured vitest
summary is invisible to the anchor the leg parses with.

Does not prove: that the parser is the ONLY reason the leg fails on a runner — the client child's own
full stdout is not in these artifacts, so that causality rests on the regex measurement plus the
forced-colour reproduction the G2 lane is producing.



## the two `NEW RED(S) 1:` lines, as they appear (this is where the misreading happened)

- run 37814101108:
  - `NEW RED(S) 1: TEST packages/testkit`
  - `NEW RED(S) 1: TEST packages/testkit/test/a4p7-merge-gate.test.ts::A4-PR7 §7.6 — the code merge gate, driven by real commands the client lane (the root suite cannot see it, and this gate says why) the cli`
- run 37815648878:
  - `NEW RED(S) 1: TEST packages/testkit`
  - `NEW RED(S) 1: TEST packages/testkit/test/a4p7-merge-gate.test.ts::A4-PR7 §7.6 — the code merge gate, driven by real commands the client lane (the root suite cannot see it, and this gate says why) the cli`

