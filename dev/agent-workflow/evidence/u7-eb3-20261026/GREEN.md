# EB3 GREEN (C4) — the negatives are now detected, the positives are preserved

Worktree HEAD at capture: rebased onto `origin/master` = `4912f3197` (PR #393). Commits:
C1 `ed5bc6aaf`, C2 `fa768a20d`, C3 `3953efe04`, C4 fixes `12ea00f65` + `687aeaac5`, P2 rebase fix `b81cb8c7f`, and this evidence commit.
master moved 32 commits under this branch mid-task; everything below was RE-RUN after the rebase.
Raw transcripts: [GREEN-existing-gate.txt](GREEN-existing-gate.txt) (mutation matrix),
[GREEN-enforcement.txt](GREEN-enforcement.txt) (controls + every check).

## A. The four negatives the plan names — RED then GREEN

Runner: `WITH_EB3=1 bash tests/checks/eb3-red-baseline.sh <out>`. Each mutation is
applied to the real tree, graded by the EXISTING gate and by the EB3 enforcement,
then reverted (`git checkout --`; refuses to start dirty, verifies clean after).

| mutation | existing gate (C2) | EB3 enforcement (C4) | which check fires |
|---|---|---|---|
| M1 declared-informational job `census-runtime` deleted | not detected | **detected** | `eb3-ci-required` → `CI_DECLARED_JOB_ABSENT` |
| M1b REQUIRED layer `ci-full` deleted | not detected | **detected** | `eb3-ci-required` → `CI_REQUIRED_JOB_ABSENT` |
| M2 unknown MCP tool in product source | not detected | **detected** | `eb3-trusted-sources` → `MCP_TOOL_UNKNOWN` |
| M3a execution Definition replaced (`via` family-body → named-bridge) | not detected | **detected** | `eb3-family-definitions` → `DEF_EXECUTION_REPLACED` |
| M3c execution Definition replaced (`nativeNames` unreadable) | detected by ARC-A fitness only* | **detected** | `eb3-family-definitions` → `DEF_NAME_UNREADABLE` |
| M4 cross-family influence (sibling internals) | not detected | **detected** | `eb3-family-boundaries` → `FAMILY_CROSS_INFLUENCE` |

\* ARC-A fitness is reached only through the census, which the current Required
context runs `--allow-refused` on hosted runners — so its verdict never reached the
merge decision. That is why M3c counted as RED for EB3 (see [RED.md](RED.md)).

**One detection in the first C4 run was wrong and was fixed, not kept.** M1 appeared
detected because `eb3-trusted-sources` was red — against ITSELF: two comments spelled
a concrete-looking wildcard MCP name, and the check reads the git index, so it passed
while untracked and failed once C3 committed it. Recording that as "detected" would
have been a green light wired to nothing. `eb3-ci-required` now emits
`CI_DECLARED_JOB_ABSENT` for a vanished declared job (`19beb3e4d`).

## B. The preserved positives

| positive | how it is preserved | evidence |
|---|---|---|
| **non-Team native control** (`u6-pr3-bl01-ask-door` CI03-b; `u6-pr2-review-r1`) | in the `ci-security` suite list, and control **P1** fails if either assertion is removed | `PASS P1 … pinned BY ASSERTION, not by title` |
| **complete known-old-red identity set** | `ci-full` runs the census with **no** `--allow-refused`, against the same baseline file; control **P2** grades the gate's own `parsePopulationBaseline`/`compareCensus` | `PASS P2 … zero BY NAMED RETIREMENT (sentinel: 9 retired against 2b1099d7); retirement names the predecessor's full set of 9 => complete; empty run => pass, one planted new red => fail` |
| `docs:probe` / `docs:sync --check` clean baseline | `blocking=0` before and after | `docs=79 notes=4 plans=49 findings=0 blocking=0` |
| `ci-pr-gate` self-test | unchanged | `DSH-CI-SELFTEST pass 77 assertions` |

## C. The five non-green states (plan: "缺席、skip、ENV_BLOCK、refused、cancel 不能绿")

Control **C5** stages each on an otherwise all-green `needs`; the grader
(`eb3-merge-tree.mjs --grade-needs`) fails every one:

`absent` · `skipped` · `cancelled` · `failure` · `ENV_BLOCK` token · `REFUSED` token ·
`SKIP` token · `verdict-missing` · `unrecognised-result` (`neutral`) · `empty needs`.

The grader enumerates the GREEN state (`result == success` **and**
`outputs.verdict == PASS`) and fails everything else, so a result value GitHub adds
later fails closed rather than falling through a red list.

## D. Commands, with results

```
node scripts/eb3-ci-negative-controls.mjs        10/10 control(s) behaved as required   exit 0
node scripts/eb3-ci-required.mjs                 pass workflows=9 findings=0             exit 0
node scripts/eb3-trusted-sources.mjs             pass files=1723 findings=0              exit 0
node scripts/eb3-family-definitions.mjs          pass files=7 findings=0                 exit 0
node scripts/eb3-family-boundaries.mjs           pass files=23 findings=0                exit 0
node scripts/eb3-run-manifest.mjs                pass records=40 strict=0 incomplete=11  exit 0
node scripts/eb3-impact.mjs --paths <unknown>    selection=<all 4 layers> unknown=1       exit 0
node scripts/eb3-security-run.mjs                PASS suites=20 files=83 passed=270 clock_ms=20000  exit 0
node scripts/docs-sync.mjs --check               blocking=0                              exit 0
node scripts/docs-probe.mjs --worktree-only      blocking=0                              exit 0
node scripts/ci-pr-gate.mjs --self-test          pass 94 assertions (was 77 pre-#393)  exit 0
node scripts/ci-pr-gate.mjs --only graph-parse --only state-freshness  pass pass=2 fail=0 exit 0
pnpm typecheck                                   all packages Done                       exit 0
pnpm exec eslint scripts/eb3-*.mjs               0 problems                              exit 0
```

The security runner's clock: one suite's first dynamic `import()` of the shipped
glue takes 5.0–7.8 s here against vitest's 5000 ms default, so the first attempt
reported a TIMEOUT, not a failed assertion. The budget is raised to 20 s and printed
on the token (`clock_ms=20000`), the same disclosure `ci-pr-gate --census-test-timeout`
already makes. A timeout cannot excuse a red assertion; it only moves the clock.

## D2. One preserved positive changed SHAPE under this branch, not by my choice

PR #393 (U7-1/EB2-C) repaired all nine census-tolerated reds and retargeted
`BASELINES.census` to `nine-root-u7-1-old-reds.md`, which states its zero with a
`RETIRED-TO-EMPTY` sentinel whose retirement table the gate requires to EQUAL the
predecessor's full set. My P2 control only knew the non-empty shape and went red on
the rebase. It now grades all three shapes (non-empty / zero-by-named-retirement /
zero-without-sentinel) and I proved it is not vacuous by staging both negative shapes
on the real file: deleting the sentinel, and a sentinel claiming 8 over a 9-row
table — the gate's own parser refuses each.

This matters for the PR's verification quote: the known-old-red set is preserved as
"complete" in the sense the plan asks — nothing was deleted to make anything green.
The nine were retired by another lane with per-identity evidence
(`u7-1-old-reds-20261026/OLD-REDS.md` plus mutation controls), and the gate refuses a
zero that cannot name them.

## E. Honest gaps

1. **`ci-required` is NOT yet the required branch-protection context.** The API still
   lists `pr-gate` alone. Making `ci-required` required is a settings action
   (`gh api … required_status_checks`), deliberately not taken by this branch: it
   would need the new workflow to have run at least once on the PR first.
2. **No hosted run has happened.** Everything above is local. `ci-security` and
   `ci-integration` are expected to pass hosted (they need no pristine host);
   `ci-full` provisions the host from the pin and is the one that could surprise —
   a cold `pnpm install` of both trees is the cost `census-runtime.yml` measured at
   ~32–60 min, which is why `timeout-minutes: 90` and the run is NOT cancellable.
3. **`dev/engineering/README.md:82`, `:109`, `:272` and `dev/engineering/doc-ownership.yaml:29`
   still say "CI wiring is EB3-B, not built here".** They are now stale. They are
   outside this task's edit scope (`.github/workflows/**`, `scripts/**`, new
   test/evidence files), so they are reported rather than edited — and `docs:probe`
   reports them as advisory, not blocking, which is why blocking stayed 0.
4. **`ci-fast`'s `docs:sync --check` is impact-selected, not unconditional.** That is
   the plan's own rule ("文档命中则跑 `docs:sync`"), and a non-selected run prints a
   named line saying so. It cannot be confused with a skip: `docs:probe` is
   unconditional.
5. **The census was not run in this session** (0 boots, no pristine host here). The
   `ci-full` layer is the wiring for it; its real result is hosted-only.
6. **`eb3-trusted-sources` books 20 fixture MCP names, 0 product names.** A booking is
   a visibility record, not an authorization: it does not bypass the Kernel.
7. **Static import edges only.** `eb3-family-boundaries` sees imports, not runtime
   influence through the Kernel, durable state or a shared provider; those remain the
   C2 suites' job (stated in the file, not claimed here).
