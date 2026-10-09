# g2-summary-parser — evidence for the A4-PR7 client-lane summary-parser fix (G2, P1)

Branch `fix/a4-g2-summary-parser`. One sentence: the merge gate's client-lane leg read
ANSI-styled vitest summaries as "no summary at all" on GitHub runners; the fix drives the lane
with the JSON reporter (machine-readable first), keeps a colour-independent text fallback,
cross-checks the exit status, and keeps every refusal the old parser had — each pinned by
witness, on the runner's own bytes.

Read `FINDINGS.md` first: the measured styled/unstyled boundary (and why the runner's colour
*trigger* is deliberately left unidentified), what is hosted-verbatim vs
assembled in `fixtures/`, the same-disease audit, and what could not be verified here.

* `hosted/` — the coordinator's census wrappers (`a1`, `a2`): both red only on this leg.
* `fixtures/` — the bytes the witnesses grade (`hosted-census-capture-1.raw.txt` is verbatim
  hosted; `client-lane-forced-colour.raw.txt` + `client-lane-report.sample.json` are a verbatim
  local forced-colour capture of the real lane; the rest are assembled probes, table in FINDINGS).
* `transcripts/` — 01 red (origin/master parser, 6/7 witness legs red, same failure text as
  hosted), 02 green (shipped parser, same bytes, incl. the `observed` measurements), 03
  forced-colour proof, 04 full merge-gate suite, 05 whole `packages/testkit/test` directory,
  06 colour matrix (what styles vitest's reporter on this box — and why the runner's own
  trigger is deliberately unidentified).
* `make-fixtures.mjs` — deterministic hosted→fixtures builder (asserts its splices).
* `parse-hosted-bytes.mjs` — the green witness harness (`node parse-hosted-bytes.mjs`, exit 0).
* `witness-block.ts` — the legs appended to the verbatim origin/master file for transcript 01
  (never lands on the branch; kept to show exactly what the red run graded).
