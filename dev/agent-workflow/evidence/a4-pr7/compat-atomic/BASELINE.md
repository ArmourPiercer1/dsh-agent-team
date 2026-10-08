# A4-PR7 compat-atomic — BASELINE battery (pristine tree, before any change)

Lane: `feat-a4-compat-atomic-state`, worktree `.worktrees/a4-compat-atomic-state`.
Base: master `606a0be7` ("Merge pull request #196 from …/fix/a4-graph-yaml").
Everything here was measured on the untouched worktree, before a single
`packages/**` file was modified, so every later number has something honest to
be compared against.

Environment: node `v24.21.0`, pnpm `11.7.0`, vitest `4.1.11`.
Per-run environment: `CI=true`,
`XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache`, and
`rm -rf packages/testkit/test/.tmp-fault` before every vitest invocation.
Rate loops are strictly sequential (`runloop.sh`: one run at a time, no `&`, no
`vitest --no-file-parallelism` tricks), which is the measurement protocol the
p6t1-flake lane used, so the numbers are comparable to theirs.

## Nine-root census (identity sets, not counts)

```
npx vitest run packages/{contracts,domain,legacy,remote,runtime,storage,testkit,tools,client}/test \
  --reporter=json --outputFile=…/scratch/census-base.json
```

- `raw/census-base.log` — the human-readable tail of that run (exit 0).
- `scratch/census-base.json.gz` — the machine-readable report (387 KB compressed;
  the 2.9 MB uncompressed file is regenerable and deliberately not committed).
- `census-base-identities.txt` — `node scripts/fail-set.mjs capture … --out …`:
  **22 identities = 19 failing tests + 3 collection-failing files**, across
  **505 files / 6288 legs**.
- `census-baseline-from-md.txt` — the 22 identities of the published baseline
  `../population-baseline/nine-root-2162f6a7.md`, re-expressed in the referee's
  identity grammar (`TEST <path>::<full name>`, `FILE <path>::COLLECTION-OR-UNHANDLED`).
- `node scripts/fail-set.mjs diff census-baseline-from-md.txt census-base-identities.txt`
  → `baseline=22 current=22 NEW=0 FIXED=0`, exit 0. The base of this lane is the
  published red set exactly; no drift to inherit and none to explain.

Per-root file counts of the base census:
`client 27, contracts 13, legacy 7, domain 26, remote 15, storage 23,
testkit 29, tools 12, runtime 353` (= 505).

## `p6t1-parallel` solo rate (the family this lane touches)

`base-p6t1parallel-transcript.txt` — 20 sequential solo runs at base:
**0 failed runs of 20**, `redlegs=0` in every run, wall 1.2–1.9 s each.
This is the rate the fix must preserve (the plan's bar is 0/N over ≥20 runs, and
the number that matters is the RATE, not a label).

## Derived totals

- `packages/*/test/*.ts` `expect(` occurrences: **22888**
  (`grep -rc 'expect(' packages/*/test/*.ts | awk -F: '{s+=$2} END {print s}'`).
- `p4t6-session-event-scan` derived total on this tree: **1039**
  (`983 + Σ SCANNED_PATHS_<LANE>.length` as of `SCANNED_PATHS_A476GAPS`), leg
  green (10/10). The total is re-derived by this lane, not quoted: the new spec
  was landed FIRST and the leg went RED with `expected 1040 to be 1039`
  (`raw/p4t6-pre-extend-RED.log`) before the file was NAMED in
  `SCANNED_PATHS_A4COMPATATOMIC`.
- `node scripts/lint-identities.mjs --diff …/a4-lint-baseline/lint-identities-0237d487.txt`
  → `76 distinct; new 0, resolved 0` (`raw/lint-identities-base.txt`).
- `pnpm --no-bail -r run typecheck` → 0 `error TS` lines (`raw/typecheck-base.log`).
- `pnpm run lint` → `160 problems (128 errors, 32 warnings)`
  (`raw/lint-base.log`) — the pre-existing 128-error floor this lane must not grow.
- `packages/testkit/test/a4p7-merge-gate.test.ts` → **29/29 green** (read out of
  the census report; that file is not touched by this lane).

## What the base already proves about the defect

The base tree already contains the escalation evidence
(`../p6t1-flake/FINDINGS.md`, `../p6t1-flake/probe/repro.probe.ts`): with a
monotonic clock, 12 rounds of two `authority.evaluate()` calls over ONE
repositories object produce 12 `chainOk` and 12 `reprobe-failed` — the loser is
deterministic, not unlucky. The characterization commit of this lane re-pins the
same product event as named fault/decision identities inside the shipped
instruments, which is what the fix is then allowed to change.
