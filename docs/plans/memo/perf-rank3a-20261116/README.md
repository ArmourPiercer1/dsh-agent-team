# PERF-RANK3A 2026-11-16 — NOT SHIPPING: the census/`ci-product` duplication is real, but after rank 1 it is worth ~15 s per capture, below its own 60 s bar

> Dated: 2026-11-16 · Status: **DECISION MEMO — rank 3a measured and refused; no code change in this PR** ·
> Base: `origin/master` @ `e6519b0d5`, tree `d18ce6846f552c5de663bbdeeb9ed2f51b48482a`
> Parent: `docs/plans/memo/perf-diag-20261115/README.md` §7 row 3a. Predecessor: `docs/plans/memo/perf-rank1-20261116/README.md`
> (rank 1, merged as #782). Ranks 2, 3b, 4, 5, 6 remain rejected/blocked and are untouched.

## 0. Decision

**Rank 3a is not shipping.** The premise is true — `packages/testkit/test/a4p7-merge-gate.test.ts` does re-run three
instruments that the Required ci path already ran on the same merge tree, and that duplication cost
**63.0 s per census capture** on the post-rank-1 hosted runner. But rank 1 (`maxWorkers=4`) changed the arithmetic
that made rank 3a look worth ~55 s: the same removed work now buys **≈15 s per capture / ≈30 s per two-capture job**
locally, projected **25–45 s** hosted. Rank 3a's own rollback rule was "revert if the census leg is not at least
~60 s faster than the 761 s baseline"; a change is not worth shipping when its best-case saving is below the bar it
would be judged by — especially a change that narrows *where* a merge gate is proven.

This PR therefore contains this memo and nothing else. Nothing was removed, no workflow changed, no Required context
changed, and the census population is byte-identical. The same-tree precondition proof, the corrected CI picture and
the measured numbers are recorded below so a future attempt starts from facts instead of the memo's estimate.

Three findings outlive the decision:

1. **`ci-product` is not a Required context.** The Required contexts on `master` are `pr-gate`, **`ci-required`** and
   `pr-settlement-gate`. `ci-product` is a **mandatory layer of `ci-required`** — it has no `if:`, `ci-required`
   `needs:` it, and the Required verdict grades `toJSON(needs)` through `scripts/eb3-merge-tree.mjs --grade-needs`.
   That is the guarantee rank 3a needed, but it is not what the brief said.
2. **`ci-product`'s gate runs eight host-free legs, not exactly three.** The three instruments rank 3a would delegate
   are a subset of `--only graph-parse,kit-home-guard,state-freshness,install,blueprint-fence,typecheck,lint-identities,artifacts-at-head`,
   executed by one `scripts/ci-pr-gate.mjs --full` invocation on the same tree.
3. **Rank 1 halves rank 3a.** The saving is (removed work) / (effective packing). Rank 1 took packing from 2.46 to
   3.3–4, so the 67.6 s/capture estimate became ~15 s of wall per capture. Any future perf lane of this shape must be
   re-priced after the packing change, not against the pre-rank-1 model.

## 1. What rank 3a proposed

Inside the census, `a4p7-merge-gate.test.ts` ran three instruments live:

| test in `a4p7-merge-gate.test.ts` | what it spawned |
| --- | --- |
| `lint closes as an identity diff against the named baseline, not against a count` | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` |
| `the commit carries its own build, judged in a scratch worktree — …` | `node scripts/check-artifacts-at-head.mjs` |
| `every workspace package that declares a typecheck script typechecks` | `pnpm -r run typecheck` |

The proposal: in the census only, stop re-running them (`DSH_CENSUS=1` marker at the census spawn), because
`ci-product` already runs them in the same `ci-required` run on the same synthetic merge tree. The census would keep
proving its population (24 tasks / 12 roots / 712 files / 9309 assertions) and `ci-product` would own the three
instruments — with a fail-closed guard making the second runner's disappearance impossible to miss.

## 2. Precondition as actually measured

Question: does the Required CI path really run those three instruments over the **same merge tree** the census grades?

### 2.1 The Required-context picture (corrected)

`gh api repos/ArmourPiercer1/dsh-agent-team/branches/master/protection`, 2026-11-16 (verbatim, abridged to the block
that matters):

```json
{"required_status_checks":{"strict":true,
  "contexts":["pr-gate","ci-required","pr-settlement-gate"],
  "checks":[{"context":"pr-gate","app_id":15368},
            {"context":"ci-required","app_id":15368},
            {"context":"pr-settlement-gate","app_id":15368}]},
 "enforce_admins":{"enabled":true},"allow_force_pushes":{"enabled":false}}
```

The ruleset list holds one ruleset, `default`, `enforcement: "disabled"` — branch protection is what is in force.
**`ci-product` is absent from that list**, by design: it is a layer, not a context.

### 2.2 The layer is mandatory and graded by the Required context

`.github/workflows/ci-required.yml` (verbatim):

```yaml
  ci-product:
    name: ci-product
    needs: synthesize
    uses: ./.github/workflows/ci-product.yml
    with:
      merge_tree: ${{ needs.synthesize.outputs.tree }}
```

```yaml
  ci-required:
    name: ci-required
    if: always()
    needs: [synthesize, ci-fast, ci-integration, ci-security, ci-product, ci-census]
    ...
      - name: Grade every layer (absence, skip, cancel, ENV_BLOCK, refused and failure are all NOT green)
        env:
          EB3_NEEDS_JSON: ${{ toJSON(needs) }}
        run: node scripts/eb3-merge-tree.mjs --grade-needs "$EB3_NEEDS_JSON"
```

There is no `if:` on the `ci-product` caller (unlike `ci-census`, which carries the draft/`ci-defer-full` deferral),
so whenever the census runs, `ci-product` runs — same run, same tree. `dev/ci/eb3-ci-manifest.json#aggregate`
declares the same Required context: `{"workflow":".github/workflows/ci-required.yml","job":"ci-required","context":"ci-required"}`.

### 2.3 The gate runs the three instruments — and five more

`.github/workflows/ci-product.yml`, the gate step (verbatim):

```yaml
      - name: Gate — the eight host-free legs; ANY skip and ANY refusal is a failure
        run: |
          set -o pipefail
          mkdir -p "$XDG_CACHE_HOME"
          node scripts/ci-pr-gate.mjs --full \
            --only graph-parse,kit-home-guard,state-freshness,install,blueprint-fence,typecheck,lint-identities,artifacts-at-head \
            --store-dir "$DSH_CI_STORE_DIR" \
            --transcript-dir "$RUNNER_TEMP/gate-transcripts" \
            2>&1 | tee "$RUNNER_TEMP/gate-run.txt"
```

`scripts/ci-pr-gate.mjs` implements the same commands the nested legs ran (same scripts, same baseline; the
artifacts leg additionally takes `--store-dir` for its scratch install):

| instrument | nested leg (what the census ran) | `ci-pr-gate` leg |
| --- | --- | --- |
| typecheck | `pnpm -r run typecheck` | `pnpm typecheck` (root script = `pnpm -r run typecheck`) |
| lint-identities | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | same script, same baseline (`ctx.baselines.lint`) |
| artifacts-at-head | `node scripts/check-artifacts-at-head.mjs` | same script, plus `--store-dir` |

Hosted proof that these legs really execute and pass, from the **same run the census baseline comes from**
(run [`43814285262`](https://github.com/ArmourPiercer1/dsh-agent-team/actions/runs/43814285262), run number 1245),
its `ci-product` transcript, verbatim:

```
DSH-CI-LEG leg=typecheck verdict=pass seconds=20.5 detail=pnpm typecheck clean (all packages, tests included — tsc is the only leg that sees a bad .test.ts)
DSH-CI-LEG leg=lint-identities verdict=pass seconds=20.2 detail=identity diff clean (baseline dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt: 76 distinct; new 0, resolved 0) …
DSH-CI-LEG leg=artifacts-at-head verdict=pass seconds=13.6 detail=HEAD carries its own build (DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=HEAD verdict=ok compared=2088 drift=0)
```

### 2.4 Same merge tree — the evidence

`ci-required` calls every layer with `merge_tree: ${{ needs.synthesize.outputs.tree }}`, and every layer asserts it
before doing any work:

```yaml
      - name: Bind to the synthetic merge tree (EB3_MERGE_TREE)
        run: node scripts/eb3-merge-tree.mjs --assert-tree "${{ inputs.merge_tree }}"
```

From the same hosted run (the 761 s census baseline):

- `synthesize-merge-tree` log, verbatim:
  `EB3-MERGE-TREE tree=d18ce6846f552c5de663bbdeeb9ed2f51b48482a commit=76b287171aaef686c1d953cce2d5bf8546c7a1b5 base=7d1d552590e7aa30d63be1cfdc6e18760a67431a head=00356a9191ee47fd3e129754fa993f6baa24a5a2`
  followed by `EB3-MERGE-TREE synthetic == checked-out tree d18ce6846f552c5de663bbdeeb9ed2f51b48482a`.
- Both layers' transcripts record the same checked-out commit:
  census `DSH-CI-RUN head=276f1437c mode=full … available_parallelism=4 workers=4`;
  `ci-product` `DSH-CI-RUN head=276f1437c mode=full … available_parallelism=4 workers=4`.
- The census's own timing identity names the graded tree, e.g.
  `census-capture/nine-roots/1 … identity product_merge_tree=d18ce6846f552c5de663bbdeeb9ed2f51b48482a;head=276f1437cbf8515da040482ca5de5a897a32b42d;host_commit=639ed015397290b3745d163aafe02ffee4aa3f84`
  (attempt 2 identical).
- `276f1437c` is GitHub's `refs/pull/782/merge` commit; its tree is `d18ce684…`, the tree synthesize computed and
  each layer asserted. A mismatch fails the step before any leg runs.
- Reproduced locally: the measurement worktree was `e6519b0d5`, whose tree is **the same** `d18ce684…`, and the
  local plan-mode census printed `DSH-CENSUS-PLAN … plan=sha256:a647f6ad81bed6536f380bdddfff76bdcefadc1f8d257dab64fe7c2f8497c4e9 … merge_tree=d18ce684…`
  — **byte-identical to the hosted post-rank-1 plan digest**, so the population and the argv are the hosted ones.

**Can the two trees differ?** Not in content: both grade the same `refs/pull/N/merge` checkout and both assert the
same supplied tree id. What is not shared is environment — separate runner VMs, separate install/build, and
`ci-product` builds before the gate. That difference cannot make an instrument vacuous here, because
`check-artifacts-at-head` compares the *commit* to a fresh build of that commit, not the two working trees to each
other. The honest claim is "the same tree is graded a second time, on a second runner", not "one process grades it".

## 3. The post-rank-1 arithmetic

### 3.1 The duplication is still real: 63 s per capture hosted

Re-measured from run 1245's census transcripts (same merge tree, 4 vCPUs, `workers=4`), the three nested subtests:

| instrument | capture 1 | capture 2 | mean |
| --- | ---: | ---: | ---: |
| lint-identities (`--diff` baseline) | 25.753 s | 20.549 s | **23.151 s** |
| artifacts-at-head (scratch build) | 15.980 s | 16.812 s | **16.396 s** |
| `pnpm -r run typecheck` | 24.484 s | 22.459 s | **23.472 s** |
| **sum** | **66.217 s** | **59.820 s** | **63.019 s** |

The perf-diag memo's figure was 67.6 s/capture. Post-rank-1 it is 66.2 / 59.8 s — the magnitude holds, the number
moved slightly. The whole file was 191.423 / 183.058 s in that run, so the three instruments are 33.7 % of it.

### 3.2 What that buys is now small, because packing changed

A capture's wall is not "total test work": rank 1 raised `maxWorkers` to 4, and measured effective packing on this
population went from ~2.46 (pre-rank-1) to ~3.3–4. The saving from deleting W seconds of work is roughly **W / P**,
not W. Post-rank-1: **63.0 / 4 ≈ 15.8 s per capture**, i.e. **≈32 s per two-capture job** — before the wall-versus-tail
correction, which can only make it smaller. The memo's −55 s/job came from `67.6 / 2.46 × 2`; that divisor is gone.

## 4. Local A/B — measured, not modelled

Method: exact CI argv, same tree, same caches, 4 CPUs pinned (`taskset -c 0-3`, 16-logical-CPU / 30 GiB host). The
only difference between arms is the census marker's value — `'0'` (arm A: the three nested legs run, i.e. the
pre-change behaviour) and `'1'` (arm B: delegated, i.e. the change). Population, plan, argv and every other leg are
therefore identical, and both arms run the full two-capture pair.

```bash
taskset -c 0-3 env CI=true node scripts/ci-pr-gate.mjs --full \
  --only census --census-execution plan --census-captures 2 --census-test-timeout 90000 \
  --store-dir <worktree>/.artifacts/pnpm-store \
  --transcript-dir <worktree>/.artifacts/ab/<arm>
```

Two independent pairs were run per arm (A1/A2, B1/B2). Per-capture numbers:

| arm | pair | capture 1 wall | capture 2 wall | work (c1) | work (c2) | a4p7 file (c1 / c2) | leg (2 captures) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A (nested legs run) | A1 | 307.36 s | 311.17 s | 1030.13 s | 1035.83 s | 136.46 / 136.66 s | 621.2 s |
| A | A2 | 308.45 s | 308.12 s | 1032.97 s | 1028.79 s | 135.76 / 135.88 s | 619.3 s |
| B (delegated) | B1 | 321.37 s | 297.34 s | 981.05 s | 980.67 s | 104.64 / 93.81 s | 621.4 s |
| B | B2 | 292.65 s | 293.59 s | 969.99 s | 971.76 s | 89.54 / 88.02 s | 588.9 s |

Arm means: A wall 308.78 s, work 1031.93 s, a4p7 136.19 s; B wall 301.24 s, work 975.87 s, a4p7 94.00 s.
The two arms' **work** separates cleanly and repeatably (−60.0 s/capture); the **wall** does not separate cleanly
across all four samples, because B1's first capture (321.4 s) is a warm-up outlier — its own second capture is
297.3 s, and its B2 pair is 292.7 / 293.6 s.

The controlled measurement is the consecutive quiet pair **A2 vs B2**, whose four samples are within 0.4 s of each
other:

- wall: **308.29 s vs 293.12 s → −15.17 s per capture**;
- two-capture leg: **619.3 s vs 588.9 s → −30.4 s per job**;
- work: 1030.88 s vs 970.88 s → −60.0 s per capture; model check 60.0 / 4 = 15.0 s ≈ the measured 15.2 s;
- `a4p7-merge-gate.test.ts`: 135.82 s vs 88.78 s → −47.0 s per capture (arm B also carries ~5 extra guard tests in
  this local measurement tree; the hosted pre-change file was 187 s, so the local file is not the hosted one).

Both arms' censuses ended `aggregate=FAIL` on this machine for a **known local-environment reason**: the
`a5sf-os-runner` network-deny refusal test fails here (6.5 s, identical in both arms; rank 1's local arms saw the same
class of red). That is not a rank-3a effect — it appears identically in arm A — but it means these are timings of a
full-population run, not of a green one. Hosted green runs are the L2's job.

**Measured saving: ~15 s per capture, ~30 s per two-capture job** (local), with the work-side removal ~60 s/capture.
Hosted projection: **−25…−45 s/job** (63 s/capture of work divided by 4, or divided by the hosted wall/work ratio
2.94, whichever bound one takes; the hosted file is also not the longest — `alpha5-glob-backend-adversarial` is
206.5 s vs a4p7's 191.4 s, so the tail cannot make the saving larger).

## 5. Why this is not shipping — and what would make it worth trying again

**Decision: not shipping.** The duplication is real (63 s/capture of instrument work), but after rank 1 it converts
to ~15 s/capture / ~30 s/job locally and ~25–45 s/job hosted. Rank 3a's own acceptance bar was "the census leg must
be at least ~60 s faster than the 761 s post-rank-1 baseline". A coverage-narrowing change whose best case is below
the bar it would be reverted by is not worth an L2, let alone a merge.

**Entry condition for a future attempt** (measurable, not vibes): the saving is `W / P × captures`, where `W` is the
three instruments' per-capture work and `P` the effective packing. With `W ≈ 63 s` and 2 captures, ≥60 s/job needs
**P ≲ 2.1**; alternatively `W` would have to roughly double (~126 s/capture) at today's packing. So re-open rank 3a
only if one of these holds, measured on the then-current tree:

- the census's effective packing falls back to ~2 or below (e.g. a 2-vCPU runner class, or `maxWorkers` reduced for
  a different reason) — then the same removal is worth ≥60 s/job again;
- the three instruments get materially more expensive (population grows, typecheck grows, a scratch-build cost
  increase) such that `W / P × 2 ≥ 60 s`;
- the census population grows enough that the file-level tail stops dominating, which changes `P` in the same
  direction.

Conversely it should **not** be re-opened merely because the memo's 67.6 s number still appears somewhere: that
number is pre-rank-1.

## 6. What a future attempt must carry (plan, not done here)

If the entry condition is met, the change is small but must land with all of the following — none of which is in this
PR:

1. **A fail-closed guard first, as a prerequisite.** A check that `ci-product`'s gate still lists
   `typecheck`, `lint-identities`, `artifacts-at-head`; that the layer is still called by the Required `ci-required`
   without a job-level `if:`; that `ci-required` still `needs:` it and still grades `toJSON(needs)`; and that each
   instrument still exists in `scripts/ci-pr-gate.mjs`. It must red **by instrument name**, with a negative control
   that strips one instrument from a scratch copy of `ci-product.yml` and one that drops `ci-product` from
   `ci-required`'s `needs`. This was prototyped and verified against the real workflows during this investigation
   (see §7); it belongs in the future PR, not this one.
2. **Census-only scoping**: the marker must be set at the census spawn (`scripts/census-invocation.mjs` +
   `censusSpawnEnv()` at every `ci-pr-gate.mjs` census spawn), never in the workflow, never in the plan argv, so
   local `pnpm test` still runs all three.
3. **Population/plan untouched**: prove 24 tasks / 12 roots / 712 files and the same plan digest
   (`sha256:a647f6ad…` on this tree), and that the other nested legs (lint-visibility, the scratch-instrument test,
   the client lane — rank 3b remains rejected) still execute.
4. **Local A/B on a quiet machine, in consecutive pairs**, reporting per-capture wall, per-capture work and the
   two-capture leg; one pair is enough only if the arms' work separation is ≥10× the wall noise. Quote the marker
   method (`'0'` vs `'1'`) rather than stashing, so population and argv are provably identical.
5. **Hosted L2 + rollback rule**: the census leg from the PR's own run versus the post-rank-1 baseline **761 s**
   ([run 43814285262](https://github.com/ArmourPiercer1/dsh-agent-team/actions/runs/43814285262); captures
   401.9 + 357.6 s). Revert if the leg is not ≥ ~60 s faster, or if any new red/refusal/retry appears. Revert the
   squash commit:

   ```bash
   git revert --no-edit "$(gh pr view <PR-number> --json mergeCommit --jq .mergeCommit.oid)"
   ```

   (fallback: `git revert --no-edit "$(git log origin/master -1 --format=%H --grep='#<PR-number>')"`).

## 7. What was verified here and deliberately left out of the PR

The guard and the removal were built and measured in a worktree during this investigation, then reverted; this PR's
diff is the memo only. Recorded so the work is not repeated blindly:

- Guard prototype (`scripts/rank3a-instrument-coverage.mjs` + 5 tests inside `a4p7-merge-gate.test.ts`) run against
  the real workflows: PASS line
  `RANK3A-COVERAGE verdict=PASS required=ci-required layer=ci-product instruments=typecheck,lint-identities,artifacts-at-head ci_product_only=graph-parse,kit-home-guard,state-freshness,install,blueprint-fence,typecheck,lint-identities,artifacts-at-head`.
- Negative control, one instrument stripped from a scratch `ci-product.yml`:
  `RANK3A-COVERAGE verdict=FAIL findings=1 … RANK3A_INSTRUMENT_NOT_IN_CI_PRODUCT instrument=lint-identities … this is a coverage hole, not a performance win` (exit 1); restore → PASS.
- Negative control, `ci-product` dropped from `ci-required`'s `needs`:
  `RANK3A_CI_PRODUCT_NOT_GRADED … does not list 'ci-product' in needs` (exit 1).
- Census-only scoping verified: with the marker at `'1'` the three legs printed
  `rank3a: instrument=<name> delegated_to=ci-product layer_of=ci-required tree=merge-tree …` and `a4p7` fell to
  ~94 s; with `'0'` they ran live and `a4p7` was ~136 s, with lint-visibility, the scratch-instrument test and the
  client lane running in both arms.
- The guard is **not** a reason to ship the removal: without the removal it protects nothing, which is why it is
  described as a prerequisite in §6 rather than carried here.

## 8. Gates on this docs-only tree

Run on the final tree (memo only; nothing in `packages/`, `scripts/` or `.github/` differs from `origin/master` @
`e6519b0d5`):

```
node scripts/test-catalog.mjs --max-uncollected 84
  DSH-TEST-CATALOG tests=872 digest=sha256:5f71c543f353fe49d099095289d2824263f4e99c8a41bd5eb60747ee2dd618b6 refused=0 findings=0
node scripts/dispatch-tests.mjs --check
  DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=18 bad=0
node scripts/docs-sync.mjs --check
  docs:sync --check: docs=166 notes=4 plans=125(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
  baseline …: 76 distinct; new 0, resolved 0
node scripts/eb3-ci-required.mjs
  EB3-CI-REQUIRED pass workflows=10 findings=0
node scripts/ci-pr-gate.mjs --self-test
  DSH-CI-SELFTEST pass 94 assertions
git diff --check
  clean
```

The catalog digest `sha256:5f71c543…` is the same digest the census catalog carried on this tree, so the docs-only
change did not move the catalog.

## 9. Provenance

- Hosted baseline: run [43814285262](https://github.com/ArmourPiercer1/dsh-agent-team/actions/runs/43814285262)
  (run number 1245, head `276f1437c`, merge tree `d18ce684…`), census leg 761 s, captures 401.9 / 357.6 s;
  `ci-product` gate legs 20.5 / 20.2 / 13.6 s on the same head.
- Local tree: `e6519b0d5` (tree `d18ce684…`), plan digest `sha256:a647f6ad…` (identical to hosted).
- Local A/B artifacts (not committed): `.artifacts/ab/{arm-A,arm-A2,arm-B,B2}/`, census reports under
  `.artifacts/census/`, per-leg single-file run `.artifacts/ab/legs-normal.json` (lint-identities 14.783 s,
  artifacts-at-head 20.342 s, typecheck 14.982 s; whole file 137.265 s normal vs 72.767 s delegated).
