# EB3 GREEN (C4) — the negatives are now detected, the positives are preserved

Worktree HEAD at capture: rebased onto `origin/master` = `4912f3197` (PR #393). Commits:
C1 `ed5bc6aaf`, C2 `fa768a20d`, C3 `3953efe04`, C4 fixes `12ea00f65` + `687aeaac5`, P2 rebase fix `b81cb8c7f`, runner fix `50824869e`, and this evidence commit.
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
node scripts/eb3-impact.mjs --paths <unknown>    selection=ci-fast,ci-full,ci-integration,ci-security unknown=1  exit 0
node scripts/eb3-security-run.mjs                PASS suites=19 files=19 passed=250 clock_ms=20000  exit 0   (host-free)
node scripts/eb3-security-run.mjs --layer ci-full --list-file tests/checks/eb3-host-security-suites.txt
                                                 PASS suites=1 files=1 passed=20   clock_ms=20000  exit 0   (host-PROVISIONED)
node scripts/eb3-impact.mjs   (no --base)        REFUSED NO_BASE (the ONE non-zero exit, by design)  exit 2
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

## D3. PR #395's FIRST HOSTED RUN WAS RED, and what came out of it

`ci-security` reported `verdict=FAIL suites=20 files=83 passed=267 failed=3` (run
40337197705). The layer behaved correctly — red, not laundered — but the local
**270/270 was HOST-ASSISTED** and I should have caught that before pushing:
`a5-pindir-reserved-native.test.ts` resolves the pinned host checkout
(`findTestRepoRoot` / `TEST_USE_REL` / `TEST_USE_BASELINE_SHA`), which this worktree
has and the hosted runner does not. It was the only one of the 20 so affected.

`files=83` in that token was ALSO wrong: the runner used `numTotalTestSuites`, which
counts DESCRIBE BLOCKS. It now reports the real file count and REFUSES when that count
differs from the number of listed suites — a listed suite vitest never reported did
not run. (ci-security is 19 files / 250 tests, ci-full's host list 1 file / 20 tests.)

The suite was **moved, not dropped**: it is now
`tests/checks/eb3-host-security-suites.txt`, run by **ci-full** through the same token
runner with `--layer ci-full`, and **ci-full is called by ci-required on every PR** —
so this security control still gates every PR, it just runs where the host exists. The
move is recorded in `dev/ci/eb3-ci-manifest.json` → `movedSuites`, both lists carry a
tombstone/pointer comment, and `CI_SUITE_MOVE_DANGLING` reds if a recorded move points
at an unknown or non-host layer.

Two STATIC guards now make the incident unrepeatable, and both were proven RED first
([R1-RED.txt](R1-RED.txt)):

* `CI_HOST_DEPENDENT_SUITE_IN_HOST_FREE_LAYER` — a layer declared `hostFree` may not
  list a suite naming a host-dependence marker.
* `CI_LAYER_LEG_MISSING` / `CI_LAYER_LEG_WEAKENED` — see D4.

## D4. The mandatory-leg rule was a substring search (R1 review blocker)

`stepsText(job).includes(leg)` accepted `echo docs:sync --check`, a `#` comment inside
`run:`, a step `name:`, a quoted string handed to `printf`, or the census invocation
carrying `--allow-refused census`. The R1 review proved the echo evasion; I staged nine
of them and ALL were undetected.

The manifest now declares each leg as the CONCRETE INVOCATION it must perform
(`{cmd:['node','scripts/docs-sync.mjs'], check:['--check']}`; for census:
`check:['--full','--census-captures','--census-test-timeout']`,
`forbid:['--allow-refused','--skip']` with `--allow-refused census` matched by VALUE).
`scripts/eb3-ci-required.mjs` parses each `run:` script into simple commands
(`commandsOf`) and grades what would EXECUTE.

The YAML fact it rests on, MEASURED not assumed: a `#` line between steps is a YAML
comment the parser drops (a commented-out step cannot invoke anything); a `#` line
inside `run: |` is part of the script string, so the checker strips shell comments
itself; `name:` is never read. It is not a shell — a construct it cannot parse never
SATISFIES a leg, which is the safe direction.

Weakening is separated from absence: `|| true`, an un-`pipefail`ed pipe, a conditional
step, a missing required flag, or a forbidden flag each report `CI_LAYER_LEG_WEAKENED`
naming which.

**Item 4 — the same pattern elsewhere: three more found, all fixed** (C11, RED first):
`always()` was matched as a substring, so `if: ${{ always() && false }}` passed (both on
the summary job and on the layer verdict step); `computesFromJobStatus` accepted a
`job.status` mention anywhere, so deleting the `case` and writing a constant `PASS`
passed because a log line still mentioned it; and the synthesize/grade steps were
matched by text, so `echo`ing them passed. Now: `always()` must BE the condition
(no `false`, no negation), the verdict value must be traced from the `case` block that
assigns it, and synthesize/grade must be EXECUTED with `EB3_NEEDS_JSON` bound exactly
to `${{ toJSON(needs) }}`.

## D5. A THIRD wiring defect, found by reading the first hosted run

The first hosted run's aggregate reported `EB3-REQUIRED fail … nongreen=ci-fast:verdict-missing,ci-integration:verdict-missing,ci-security:failure,ci-full:verdict-missing` — while the four layer JOBS themselves were green. The verdict OUTPUTS did not survive the reusable-workflow boundary, and the cause is structural, not a typo:

* `.github/workflows/ci-*.yml` trigger on `workflow_call` ONLY (one caller, no double run),
* but `gh pr checks` ALSO showed standalone `ci-fast / ci-fast`, `ci-full / ci-full` runs — because **a caller cannot pass `with:` inputs to a reusable workflow at a non-`workflow_call` event**, so GitHub fell back to a plain workflow-run: no inputs, no `outputs`, and (crucially) an unbound `${{ inputs.merge_tree }}` that made the tree assertion fail for every layer.
* `ci-required` also triggered on `push`, where the layers' `with:` inputs are likewise unusable.

Fixed: `ci-required` is now **pull_request only** (a push run has no Required verdict to make, and the event is refused by name if it somehow occurs), and each layer's tree assertion discriminates explicitly on `github.event_name` — asserting tree equality on `pull_request`, and printing a `::warning::` naming the event and the tree it actually graded otherwise, instead of passing vacuously.

**Good news from that run, recorded because it matters:** `ci-full` PASSED on the hosted runner — `DSH-CI-LEG leg=census verdict=pass seconds=604`, `DSH-CI-VERDICT pass pass=8 fail=0 skip=0 refused=0`, `DSH-CI-TRANSCRIPT-CHECK pass`. So the census genuinely runs and grades the retired baseline on a cold hosted runner; `ci-full` was not "pending forever", it takes ~15 min.

## D6. The second hosted run failed for a BOOKKEEPING reason, and I had made two real mistakes

Synthesize failed: `synthetic merge tree c14285127… != checked-out tree 1e2ef61a7…`. Two
separate defects, both mine, both now fixed and BOTH VERIFIED LOCALLY AGAINST THE REAL
MERGE REF before pushing again:

1. **Wrong base.** I used `github.event.pull_request.base.sha` (94890f090 — where the
   branch was cut). GitHub builds `refs/pull/N/merge` against the base branch's CURRENT
   tip (c5e43f1d5). The synthesize step now takes the base from the checkout's own merge
   commit: `BASE=$(git rev-parse 'HEAD^1')`, asserts the checkout is a two-parent merge
   whose second parent equals the PR head, and then recomputes the tree independently.
   Verified: `git merge-tree --write-tree c5e43f1d5 f9eee0a60` reproduces GitHub's tree
   `1e2ef61a7…` exactly, and the step now passes on the real merge ref.
2. **A commit message claimed an edit that never landed.** `c9bfeab75`'s message says
   "ci-required is now pull_request ONLY"; the workflow still had `push:`. The message
   was written from intent, not from the diff. `grep -n '^  push' ci-required.yml` found
   it. It is now genuinely pull_request-only, and the step refuses any other event BY NAME.
   Lesson recorded rather than smoothed over: a commit message is a claim, and I asserted
   one I had not checked.

The layer binding was re-simulated on the real merge ref for both event shapes: on
pull_request it asserts and passes, on push it prints `::warning::event push — the tree
assertion applies to pull_request only` and names the tree, and a tampered
`EB3_MERGE_TREE` is refused with `::error::`.

## D7. The third hosted run: two of four layers GREEN, and the same base mistake one level down

run 40344660270: `synthesize-merge-tree` PASS, `ci-fast` PASS, **`ci-security` PASS**
(the host-dependency move and the static guard are confirmed on a hosted runner),
`ci-integration` FAIL on the RUN Manifest step.

The failure was MY strict RUN rule doing its job on records that are not mine:
`RUN_AUTHORITY_BINDING_MISMATCH … bindings.authority is absent on a NEW record` for five
`u7-4a-jobs-producer` records. Those arrived by merging master, but the layer's base was
`github.event.pull_request.base.sha` (where the branch was CUT) while the checkout is the
merge ref built on master's CURRENT tip — so `git diff base...HEAD` attributed every
commit merged since the cut to this PR, and `--new` marked another lane's records as new.

Same root cause as D6-#1, one level down: the LAYERS had it too, because I fixed it only
where it had failed. The base is now `HEAD^1` in all four layers, verified on a real
merge commit: `CI_BASE=c5e43f1d5` (= the merge ref's first parent), the RUN step then
passes with `strict=0`, and a non-`pull_request` event is refused by name.

## D8. The reusable-workflow boundary — the fourth "detection wired to nothing"

Hosted run 40346069026: all four layer jobs GREEN, census genuinely measured, and the
aggregate still FAILED — `verdict-missing` for every layer. A reusable workflow exposes
outputs to its caller ONLY through `on.workflow_call.outputs`; each layer declared only
`on.workflow_call.inputs`, so `needs.<layer>.outputs.verdict` was empty. The grader did
exactly its job (missing is not green); the WIRING was broken, and my static checker
could not see it because it graded `jobs.<id>.outputs` and never crossed the boundary.

**The class, stated once for all four instances in this PR:** a check that verified a
REPRESENTATION of the guarantee instead of the guarantee itself.

| # | check | graded | the guarantee it claimed | now graded |
|---|---|---|---|---|
| 1 | trusted-sources | the git INDEX | "this tree has no unbooked MCP name" (red against itself once tracked) | the index is still the scope; the self-hit was named and removed |
| 2 | mandatory legs | TEXT of step scripts | "this layer RUNS this command" | parsed, executed commands with their flags |
| 3 | security suites | a LOCAL run with the host present | "these suites pass on a hosted runner" | static refusal of host-dependent suites in host-free layers |
| 4 | layer verdict | the JOB output | "the caller RECEIVES this verdict" | the `on.workflow_call.outputs` boundary itself |

What now prevents the class, concretely: each of the four has a negative control that
removes the real thing while leaving the representation intact, and must go RED (C2 self-
scope, C9, C10, C12). And the remaining gap I can name: none of these controls executes
GitHub Actions. A fifth boundary of the same kind (an expression context unavailable at
some key, a permission the token lacks) would again be caught only hosted. That is why
the hosted run, not the local suite, is the final evidence for this PR.

## D9. The run after D8: three layers + ci-full GREEN, and a REAL enforcement gap

Hosted run 40352387786 at 820fd7e0e: the boundary fix works — the aggregate now SEES
every verdict (`ci-fast green`, `ci-security green`, `ci-full green` with the census
measured, `ci-integration failure`). ci-integration failed on my own control:
`FAIL C3 … mutation 3d did not change packages/tools/fs-family/src/fs-family-contribution.mjs`.

Master had gained `fs-family-contribution.mjs` (U7-9a): ONE contribution binding FOUR
rows (read/write/edit/read_image). Two things were wrong, and only the first was the
control's:

1. The C3 mutations were pinned to one file's spelling (`definition.execute`,
   `[definition.name]`), so on the new seed 3d was a silent no-op. Every leg now
   mutates by the same generalised shape the rule reads, and EVERY leg (3a–3d) refuses
   with "did not change" rather than reporting MISSED.
2. **The rule had a real hole.** The digest-binding check was EXISTENTIAL: it fired only
   when NO row's execute was bound. On a four-row contribution, dropping ONE row's
   binding passed — that row's body could be swapped under the same digest. It is now
   UNIVERSAL over the `sourceDocument` literal: every row it binds by `<ident>.name`
   must also bind `<ident>.execute`. Verified on the merged tree: honest pass; dropping
   only `writeDefinition.execute` →
   `DEF_EXECUTION_REPLACED … binds writeDefinition.name but not writeDefinition.execute`.
   (Scoped to the literal, because the same files build an INPUT-contract digest from
   `name: definition.name` without execute, by design.)

This is the class from D8 again — the rule verified "some binding exists", a
representation, not "this row is bound", the guarantee — and it surfaced only because
another lane added the first multi-row contribution. **Verified on a real merge with
`origin/master`, not on my branch alone: 14/14 controls.**

## D10. FIRST FULLY GREEN HOSTED RUN — and one more gap found by reading it

Run **40356648567** at `c61ab7b58`: `synthesize-merge-tree`, `ci-fast`, `ci-integration`,
`ci-security`, `ci-full`, `ci-required` — **all success**. Aggregate, verbatim:
`EB3-REQUIRED pass layers=4 green=4 nongreen=none`. ci-full:
`DSH-CI-LEG leg=census verdict=pass seconds=763.6` · `DSH-CI-VERDICT pass pass=8 fail=0 skip=0 refused=0` ·
`DSH-CI-TRANSCRIPT-CHECK pass`. pr-gate, census-runtime, candidate-protection also pass.

Reading that green log, the grader had a line I should not have accepted:
`synthesize  info-undeclared-need  a need the manifest does not declare (not graded)`.
The synthetic merge tree — the thing EB3-C makes REQUIRED — was not graded. A probe
with `synthesize: failure` and four green layers returned `EB3-REQUIRED pass` (exit 0).
It held red in practice only because the layers `needs: synthesize` and would be
skipped: correct by topology, not by rule. Now `aggregate.gradedNeeds: [synthesize]`
in the manifest, the grader requires it `success`, eb3-ci-required reds if the manifest
or the summary's `needs` drops it, and control C13 (RED first) fails if synthesize
failure / cancelled / skipped / absent ever grades green. This change post-dates that
green run, so it needs one more hosted run, reported below.

## D11. R2 F-2 — my fail-closed claim was false; the leg reader is now an ALLOWLIST

The R1 fix documented: "a construct it does not understand never SATISFIES a leg". The
R2 review falsified that with three shapes I had not listed —
`if false; then node …; fi`, `node … &`, `node … || exit 0` — and C14, run against the
R2-reviewed head 3af623b2e, found **28 of 46** evasions satisfied the leg (table:
[R2-C14-TABLE.md](R2-C14-TABLE.md)). The defect was structural: the reader enumerated
known-bad shapes and passed everything else. A denylist cannot be fail-closed, so the
claim could never have been true.

**The rule is now a positive grammar.** A leg is satisfied only when the reader
RECOGNISES all of: a step with no `if:` (or exactly always()/success()), no
`continue-on-error`, `shell:` unset or exactly `bash`, no `working-directory`, no step
`env` touching PATH/BASH_ENV/ENV/NODE_OPTIONS; a script with no `trap` anywhere; every
line before the leg drawn from a closed prelude (`set` with only `-`/errexit/nounset/
pipefail options, `mkdir -p`, plain assignments not to PATH/IFS/…, `echo` optionally
`>> "$GITHUB_*"`, other plain `node`/`pnpm` commands); and the leg line itself a single
simple command with no unquoted `; & | < > ( ) { } \` ! #` and no `$(`. The only
pipeline allowed is `<leg> [2>&1] | tee <file>` after pipefail. Anything else is
`CI_LAYER_LEG_UNPROVEN`, naming the construct.

**I narrowed the brief in one place, deliberately:** the brief allowed the leg LAST in a
pipe under pipefail. No real workflow needs it, and an upstream command feeding the
leg's stdin is one more thing to prove — so it is refused (C14 has it as a negative).

**Real workflows were rewritten into the allowed shape; the rule was not widened.**
Four lines failed the allowlist, and each one was a real ambiguity, not a false positive:
* `ci-fast` docs:sync ran inside a shell `if` on the impact selection — structurally the
  `if false; then …` evasion. It now runs **unconditionally** (0.4 s): strictly more coverage.
* `ci-integration` RUN manifest chose between two invocations in a shell `if` → one
  command, `--new-since "$CI_BASE"`, with the selection moved into the script.
* each layer's merge-tree binding (`[ … ] || { …; exit 1; }` inside an `if` on the event)
  → one command, `eb3-merge-tree.mjs --assert-tree "${{ inputs.merge_tree }}"`, which
  refuses non-pull_request events, empty input and a tree mismatch by name and exit code.
* `ci-required` synthesize (shell checks around the merge) → one command,
  `--synthesize --from-merge-ref`, carrying every check that was in the shell.
Each new single-command form was exercised on a real merge commit with master,
including all its refusals (exit 2 refusals, exit 1 mismatch).

C9's mutations were re-anchored to the reshaped line (9/9 still detected) and C9/C14
now accept `CI_LAYER_LEG_UNPROVEN` as a detection. Controls: **16/16** (C1–C14, P1, P2).

## D12. Inline assignment prefixes were unchecked — found by main-agent verification

The parent agent verified the D11 allowlist at `6c1aeda17` itself, against 18 evasions
of its own. 16 held, and so did the reviewer's three. One hole remained, and it was
**executable**: `legLine` skipped every leading `NAME=value` token on the leg line with
no check at all, so `NODE_OPTIONS=--require=<preload> node scripts/docs-sync.mjs --check`
satisfied a mandatory leg. Reproduced here: a preload `process.on('exit',()=>{process.exitCode=0})`
turns `process.exit(3)` into **exit 0** — a red leg reported green. The step-env rule
already refused NODE_OPTIONS and the prelude rule had a six-name DENYLIST; the inline
path was the one place the law was not applied, and the prelude path was the wrong
kind of law.

Fix: ONE allowlist, `LEG_ASSIGNMENT_ALLOWLIST = [CI, FORCE_COLOR, NO_COLOR, TZ, LANG, LC_ALL]`
(locale/colour/timezone/CI-flag — names that cannot change what runs, what it loads,
or how status is reported), governing **both** leg-line prefixes and prelude
assignment lines, plus the prefixes on any prelude command. Anything else is
`CI_LAYER_LEG_UNPROVEN` naming the variable. Inventory of the real workflows: no leg
line uses a prefix (the only prefixed command is ci-full's HOST build, which is not a
leg), so the list carries no name a workflow needs, and no workflow changed.

C14 gains eight negatives — NODE_OPTIONS / BASH_ENV / LD_PRELOAD / PATH / unknown FOO=1
prefixes, an allowlisted-then-forbidden chain, and NODE_OPTIONS / FOO=1 as prelude
lines. All eight were RED on `6c1aeda17` and are UNPROVEN after. It also gains three
positives (NO_COLOR, TZ+LC_ALL, prelude CI=true), so the allowlist is pinned as an
allowlist, not "refuse every assignment". Final: 52 negatives unsatisfied, 9 positives
satisfied, every real layer satisfies every leg. Controls **16/16**.

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
6. **`eb3-trusted-sources` books 22 fixture MCP names, 0 product names** (2 were added on the
   final rebase: PR #386's `u7-0-census-reconcile` plants, flagged by this very check). A booking is
   a visibility record, not an authorization: it does not bypass the Kernel.
7. **Static import edges only.** `eb3-family-boundaries` sees imports, not runtime
   influence through the Kernel, durable state or a shared provider; those remain the
   C2 suites' job (stated in the file, not claimed here).
