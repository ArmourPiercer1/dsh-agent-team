# a4-pr7 / census-runtime — the second, honest green (external review item 4)

Lane branch `ci/a4-census-runtime-gate`, worktree `.worktrees/census-runtime`, base `origin/master`.
CORE PATCH BUDGET = 0 respected: **no upstream file touched, no gate code changed** — the deliverable
is one new hosted workflow file, four comment lines in an existing one, and this folder.

## The two greens

| check | a green means | census refusal allowed? |
| --- | --- | --- |
| `pr-gate` (existing; verdict semantics untouched) | the 6 static/build legs passed; the census **declared** it could not run here (`refusedlegs=census`) | yes — declared in the invocation, so it is reviewable in a diff |
| `census-runtime` (new) | the pinned pristine host was provisioned and the nine-root census **ran**, 2 captures, identity set equal to the published baseline | **no — a refusal comes back `fail`** |

Before this, one green covered both "the static legs passed" and "the census was not measured" —
exactly what the review objected to. No new gate logic was needed: `scripts/ci-pr-gate.mjs` already
turns an undeclared refusal into `(undeclared refusal — … declare it: --allow-refused census)`, and
the new job simply withholds the exemption. `--full --only census` was chosen over a full 7-leg
re-run because the other six legs grade the checkout and the build, not the host, and `pr-gate`
already states their verdict on the same commit minutes earlier; `--full` still makes an abstention
inside the selected set a failure.

## Verification, and what each file is

Regenerate everything with `bash run-local-verifications.sh` (`--with-census` adds the ~4-minute
leg); `bash e2e-provision-run.sh` re-runs the whole chain.

| file | what it proves |
| --- | --- |
| `OFFLINE-LINT.txt` | real **actionlint 1.7.7** (none on PATH here; fetched from its GitHub release page) reports **zero findings on both workflow files**, and both linters reject a fixture carrying all three known incident classes |
| `ARGV-PROBE.txt` | the census step's argv, proven by `printf "<%s>"` introspection: 12 entries, all six flags present, **no `--allow-refused`**, block exit 0 |
| `LOCAL-STEP-DRYRUNS.txt` | each `run:` block extracted **by parsing the YAML** (with its `env:`) and executed verbatim, incl. the pin-parse and host-drift controls |
| `E2E-PROVISION-THEN-CENSUS.txt` | **the whole job as one sequence**: resolve pin → fetch pinned SHA → build host → census against THAT host → re-grade. 481 s, census `verdict=pass`. Refuses to start unless the host link is outside its own scratch and at the pinned SHA |
| `LOCAL-CENSUS-LEG.txt` | the census leg passing against the shared pristine host (`233.7 s`) |
| `LOCAL-NEGATIVE-CONTROL-MISSING-HOST.txt` | the deliverable: no host + no exemption ⇒ `verdict=fail`, exit 1, re-grade fails too |
| `LOCAL-TRANSCRIPT-REGRADE.txt` | the second reader: pass on the real transcript, fail on a missing token, an undeclared refusal, and a phantom declared refusal |
| `MEASURED-TIMINGS.txt` | every duration the `timeout-minutes: 60` figure rests on |
| `PROVISION-PROBE.txt` | the pin is fetchable from github.com with no secret, and `ls-remote` tip == pin |
| `extract-step.py` | extracts a step's script **and its env**, substituting `runner.temp` — without this a dry run executes a different program |

Census shape seen twice on two different hosts (shared pristine checkout; freshly fetched and built):
`507f/6354l`, both captures identical, identity set identical to the published baseline
`nine-root-2162f6a7.md` (10 titled reds, 0 collection files).

## Bugs found before spending a hosted run — this is what the dry runs were for

1. **Cross-step variables, twice.** `GITHUB_ENV` publishes to the *next* step; a step's own shell
   dies with it. The pin-echo line read back `$TEST_USE_SHA` (empty on a runner too), and the
   host-build step echoed `$HEAD_SHA` from the provisioning step — it printed
   `host build ok: … present at ` with nothing after it. Fixing the second one added a **re-assertion
   of the pin after the build**: measured that a host build leaves the pinned tree porcelain-clean, so
   "it is pinned *now*" is checkable, not just "it was pinned at fetch time". Its control — a wrong
   pin after a successful build — exits 1.
2. **A step's safety must not rest on an implicit default.** With the provisioning step's failure
   ignored, the next step's `cd "$HOST_DIR"` failed quietly and the step ran `pnpm install` /
   `pnpm run build` on **this repo** and reported success. Actions runs `bash -e`, so the hosted
   behaviour was already safe — but that is one `shell:` edit from being untrue. Every block now says
   `set -euo pipefail`, and the E2E re-run then went green for the right reason.
3. **The harness had the bug it was hunting.** `e2e-provision-run.sh` itself carried a `#` comment
   between backslash-continued lines — the exact defect that ate four flags in hosted run
   37801019804 — and its only symptom was a later step seeing an unbound variable. The lint caught it
   in the YAML; nothing caught it in the shell script until it misbehaved.
4. **A control of mine was wrong, and the difference is the design.** A transcript whose census leg
   *refused* and whose token *declares* `refusedlegs=census` is internally consistent and passes
   `--check-transcript`. That is correct: grading consistency is that step's job. A declared refusal
   can only be produced by passing `--allow-refused`, which this file never does — so the guarantee
   is "no undeclared refusal, and no exemption unless someone edits this file", not "no refusal at
   any cost". `LOCAL-TRANSCRIPT-REGRADE.txt` now states this and shows all three real classes failing.
5. **A killed run poisoned the harness's own restore, and the harness said "restored".** Killing an
   E2E run mid-flight left the worktree's `tests/deepseek-harness-test-use` link pointing into
   `.tmp-verify/`; the next run captured *that* as its "previous target" and, at the end, faithfully
   restored the poisoned link and reported success. The shared pristine host was verified untouched
   (`639ed01539…`, porcelain 0, `0.2.0-rc.2`, `bin.js` present) and the link is back on it. The
   harness now refuses to start unless the link is outside its own scratch **and** at the pinned SHA
   — checked live, exit 1, message naming the target. Same lesson as the workflow's `set -euo
   pipefail`: a cleanup path that cannot tell a good state from a bad one is not a cleanup path.

## Not verified, stated plainly

* **No hosted run of this file exists.** Its triggers are `pull_request` and `push` to `master`;
  pushing a `ci/*` branch cannot start it, and this lane opens no PR. The first run is the PR the
  coordinator opens. Until then "the check reports" is a prediction — the same disclosure
  `pr-gate.yml`'s header makes about itself.
* **No hosted duration.** `timeout-minutes: 60` = a measured local 8-minute whole-chain floor × a
  2–4x factor taken from `pr-gate`'s one hosted run (475.3 s hosted vs 222.4 s local, same legs).
* **Whether a 2-core runner passes the census.** The published identity set was recorded on 32 cores
  and the baseline declares a load family. If the hosted census goes red on a timing-sensitive leg,
  that is a finding about the census's host budget: narrow the leg, raise `--census-test-timeout`,
  or capture more — never add `--allow-refused`, the very exemption this job exists to withhold.
* `actions/upload-artifact` path behaviour is copied from `pr-gate`'s working step, not
  independently exercised; the concurrency `cancel-in-progress: true` behaviour is reasoned, not
  observed (it needs two same-ref pushes with a run in flight).
* **`tests/deepseek-harness-test-use/` in `.gitignore` has a trailing slash, so it does not match a
  SYMLINK at that path** (`git check-ignore` says not ignored; a real directory is ignored). Only
  affects local worktrees that link a host — like this one, and like this lane's own E2E. Nothing in
  either workflow reads the outer `git status`, so no behaviour depends on it, but anyone who writes
  a "tree must be clean" assertion must know it.

## Reproducing this folder

`bash run-local-verifications.sh` regenerates every `.txt` except the two expensive ones; add
`--with-census` for the leg, and run `bash e2e-provision-run.sh` for the whole chain (~8 min, real
network). Both write scratch under the worktree's `.tmp-verify/` — stale built hosts (~4 GB at
close-out, including the one that poisoned the symlink in finding 5) were deleted there; the
`actionlint` binary lives in that scratch too and is deliberately **not** in git. Re-fetch it with
the curl line at the top of `run-local-verifications.sh`.
