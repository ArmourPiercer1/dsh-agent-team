# How every number in FINDINGS.md was produced

All commands run in `.worktrees/a4-74-failclosed`. Nothing here edits an assertion; the
only production mutations were `git show 258d2b48:… > service.ts` (base side) and deleting
one line from `REMOTE_BACKING_ERROR_CODES` (pre-join side), each restored with
`git checkout --` and **verified by blob hash**, never by exit code:

    base service.ts blob: ea1df0656474ab37dda9186d0e6f082c3929e8dc (expect ea1df065…)
    restored service.ts blob: 8c5cce2348d3b69fb40e4d6ef9aa1a35b0100a71
    restored dispatch.ts blob: 11d0fd8d0d664bd2342dfd309855256ad923cff3

## 1. Whole-population identity census

`npx vitest run --reporter=json --outputFile=<tag>.pop.json` over the repo config
(`packages/*/test/**/*.test.ts`), then `.tmp-a474/pop-summary.mjs` reduces the JSON to three
identity files (`-all`, `-reds`, `-coll`). A leg identity is
`relpath > <suite titles joined by spaces> <test title>`; collection-error files are listed
separately, because a file that dies at collection contributes ZERO legs and a red count
cannot see it.

* base side = this branch with `service.ts` from `258d2b48` and the vocabulary member deleted
  (`postmerge-base-*`, 502 files / 6273 legs / 34 reds / 3 collection files);
* landed side = the branch as committed (`postmerge-landed-*`, same files/legs, 78 reds /
  same 3 collection files);
* `comm -13` / `comm -23` over the sorted identities give `pm-newreds.txt` (54) and
  `pm-resolved.txt` (10) — set difference of identities, not a count comparison.

The throwaway rise-gated census instrument additionally wrote `census.jsonl`, one line per
firing keyed by the vitest worker's own `fullName` (` > ` separators — normalize before
joining against the JSON reporter, see FINDINGS §6.3). 53 events: 52
`refused|authority-ceiling-port-absent` + 1 `would-refuse|authority-ceiling-context-abstained`.

## 2. The three named suites

    npx vitest run packages/runtime/test/a4p7-ceiling-no-port-refusal.test.ts   # 6 legs
    npx vitest run packages/runtime/test/a4p7-ceiling-refusal-wire.test.ts      # 5 legs
    npx vitest run packages/runtime/test/a4p7-ceiling-port-assembly-pin.test.ts # 6 legs
    npx vitest run packages/runtime/test/a4p7-carrier-width-under-ceiling.test.ts  # 8 legs (prereq 2)

## 3. Bite proofs (mutate → red → restore → verify blob)

* `mutate-bite-prechange-run.log` — production change reverted: 6 of 17 legs red (N1, N3, N4,
  W2, PIN-3, PIN-5), and PIN-3's message carries the literal fail-open verdict
  (`pin3-before.json`).
* `mutate-bite-prejoin-run.log` — vocabulary member deleted: W1/W2/W3 red with the literal
  `Received: "internal-error"`.

## 4. p4t6 referee

    node -e "import('./packages/testkit/fault-injection/session-event-scan.mjs').then(m=>console.log(m.scanSessionEventVocabulary({}).filesScanned))"

1033 at the merged base, 1035 with this lane's two instruments present
(`p4t6-PRE-EXTEND-RED.txt` holds the pre-extend red). The suite's own total stays derived
(`983 + Σ named lists`); this lane added `SCANNED_PATHS_A474FAILCLOSED` (2 paths, asserted
present by path) and the tie `2 = 1035 - 1033`.

## 5. Fence

`node scripts/verify-blueprint-version-clean.mjs` run **after `git add`**, twice; outputs in
`fence-1.txt` / `fence-2.txt`, compared byte-wise against the master tuples quoted in
HANDOFF.md.

## 6. Typecheck, both invocations, reported separately

    pnpm -r run typecheck                  # literal `error TS` count in typecheck-bail.txt
    pnpm -r run typecheck --no-bail        # literal `error TS` count in typecheck-nobail.txt

## 6b. The `--no-bail` form is an instrument that lies (measured this lane)

    pnpm -r run typecheck                      → exit 0, `error TS` count 0
    pnpm -r run typecheck --no-bail            → exit 1, `error TS` count 4  ← ALL FOUR ARE
        "error TS5023: Unknown compiler option '--no-bail'" from domain/contracts/remote/runtime
    pnpm --no-bail -r run typecheck            → exit 0, `error TS` count 0, 8 "typecheck: Done"

After `run`, pnpm forwards the flag to the package script, i.e. to `tsc`, which reports it as
a compiler error. Four "errors" with a green tree, and the bailing form's exit 0 would have
been dismissed as masking them. The count is real; its cause is the invocation. Recorded in
FINDINGS §6.
