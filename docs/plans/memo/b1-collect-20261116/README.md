# B1 — collect the 7 T5 compatibility suites

**Dated:** 2026-11-16 · **Base:** `origin/master` @ `b0f5eb4e3` · **Branch:** `task/b1-collect-20261116` · **Worktree:** `.worktrees/b1-collect-20261116`
**Scope:** batch **B1** of `docs/plans/memo/uncollected-audit-20261115/` (PR #777, audit merged at `4644dbe84`): the 7 product-vitest files under `packages/domain/compatibility/test/`.
**Conclusion first:** all 7 are **collected** by one added `include[]` glob in the root `vitest.config.ts`. Uncollected goes **91 → 84**; no new Required context, no new workflow job, no host, no test rewrite. The new coverage is negative-controlled: one mutated B1 assertion reds the same config that now collects it.

## 1. The 7 files, measured individually

All 7 were read and run before the change. They share one shape: pure TypeScript imports (`vitest`, `../src/index.js`, `../../../../contracts/src`, local fixtures), no `node:test`, no port, no `DSH_HOME`, no pristine host tree.

| # | path (all under `packages/domain/compatibility/test/`) | what it verifies (from `decisions.tsv`) | collected before? | run result |
| ---: | --- | --- | --- | --- |
| 51 | `t5-complete-true.test.ts` | `complete:true` on a persona/tool requirement is a structural FATAL with no Continue Anyway | **no** | **green** (7 tests) |
| 52 | `t5-drift-invalidation.test.ts` | an ack is bound to an environment fingerprint; drift invalidates the previous result | **no** | **green** (9 tests) |
| 53 | `t5-engine-outcomes.test.ts` | PASS/WARNING/FATAL classification: structural missing capability is FATAL | **no** | **green** (9 tests) |
| 54 | `t5-environment-facts.test.ts` | environment-fact parsing/fingerprinting and generation bumps | **no** | **green** (17 tests) |
| 55 | `t5-purity-serialization.test.ts` | compatibility result purity + remote-safe serialization round-trip | **no** | **green** (8 tests) |
| 56 | `t5-requirement-validation.test.ts` | requirement parsing/validation, Requirement != Policy | **no** | **green** (17 tests) |
| 57 | `t5-warning-ack.test.ts` | warning acknowledgement: scope, operator, timestamp; an ack does not cover a new mismatch | **no** | **green** (9 tests) |

Measured together by the real root config after the change:

```
 ✓ packages/domain/compatibility/test/t5-requirement-validation.test.ts (17 tests) 6ms
 ✓ packages/domain/compatibility/test/t5-complete-true.test.ts (7 tests) 11ms
 ✓ packages/domain/compatibility/test/t5-environment-facts.test.ts (17 tests) 9ms
 ✓ packages/domain/compatibility/test/t5-engine-outcomes.test.ts (9 tests) 12ms
 ✓ packages/domain/compatibility/test/t5-purity-serialization.test.ts (8 tests) 13ms
 ✓ packages/domain/compatibility/test/t5-warning-ack.test.ts (9 tests) 14ms
 ✓ packages/domain/compatibility/test/t5-drift-invalidation.test.ts (9 tests) 16ms

 Test Files  7 passed (7)
      Tests  76 passed (76)
   Duration  385ms
```

### "Runs nowhere in CI" — measured, not inferred

- `grep` over `.github/workflows/`, `dev/ci/eb3-ci-manifest.json`, `tests/checks/*.txt`, `scripts/dispatch-tests.mjs` leg declarations: **the only mentions of these 7 paths in the repo are the rows of `dev/ci/uncollected-baseline.json`**. No workflow step, dispatch leg, security list or contract `test_refs` names any of them.
- The root `vitest.config.ts` did not reach them (they are two levels below the package root: `packages/*/test/**` matches `packages/<pkg>/test/...`, not `packages/<pkg>/compatibility/test/...`), and no package `vitest.config.ts` reaches them either (`packages/domain/vitest.config.ts` includes only `test/**`). Confirmed by running the root config against the directory **before** the change:

```
$ vitest run --config vitest.config.ts packages/domain/compatibility/test
No test files found, exiting with code 1
filter: packages/domain/compatibility/test
include: packages/*/test/**/*.test.ts, packages/runtime/controlled-fs/test/**/*.test.ts, packages/tools/a5p5-tools/test/**/*.test.ts
```

### Host-free evidence

- Import graph (read, not inferred): every file imports only `vitest`, `../src/index.js`, `../../../contracts/src/index.js`, and `../fixtures/*` — no `tests/paths.mjs`, no `tests/deepseek-harness-test-use`, no `child_process`, no `http`/`net`, no `DSH_HOME`.
- The worktree used for these runs has **no** `tests/deepseek-harness-test-use` checkout at all (`ls` → absent), and all 7 still pass. There is nothing host-shaped to hide.
- Device/host dependence is therefore nil; the audit's "76 tests / 0.42 s" measurement is reproduced here (76 tests / 385 ms).

## 2. The collection change (exact diff)

One glob added to the root `vitest.config.ts` `include[]`; the explanatory comment sits **above** `include`, not inside the array — the catalog's `parseVitestConfig()` treats quoted text inside the array as glob strings, and an apostrophe in a comment there is read as a quote (observed and avoided during this PR).

```diff
+    // B1 (uncollected-test audit 2026-11-15, batch B1): the T5 compatibility
+    // suites sit at `packages/<pkg>/compatibility/test/`, TWO levels below the
+    // package root, so neither `packages/*/test/**` nor a package `test/**`
+    // include reaches them. They were discovered-but-uncollected
+    // (dev/ci/uncollected-baseline.json); the compatibility glob below is the
+    // one line that puts them in the root population (`pnpm test` / L2 census).
+    // Host-free: pure domain code, 76 tests / ~0.5 s.
     include: [
       'packages/*/test/**/*.test.ts',
       'packages/runtime/controlled-fs/test/**/*.test.ts',
       'packages/tools/a5p5-tools/test/**/*.test.ts',
+      'packages/*/compatibility/test/**/*.test.ts',
     ],
```

**Which leg executes it.** The root `vitest.config.ts` population is executed by the **L2 census** leg (`ci-census`, a layer of the existing `ci-required` aggregate) and by `pnpm test` locally. Its argv is the one function both the plan and the gate use (`scripts/census-invocation.mjs#censusVitestArgv`):

```
pnpm exec vitest run --reporter=default --reporter=json --outputFile.json=<capture path>
```

with the repo root `vitest.config.ts` loaded by default, one invocation per capture. This is the audit's recommended placement (`decisions.tsv`: "collect -> product vitest (root vitest.config.ts include) + regenerate census population") and needs **no** new leg/job/context. The L1 contract leg (`ci-product`: `contract-tiers --run --tier L1`) was not chosen: these files are not contract-bound in `dev/ci/test-contracts.json`, so L1 would only run them if this PR also invented a contract binding — a larger, different semantic change.

**Disclosure for this draft PR:** `ci-census` is deliberately deferred on drafts (`ci-required.yml`: draft ⇒ cheap layers only, census runs on `ready_for_review`). So on the draft PR the collection is proven by the local root-config run above plus the catalogue ratchet, and the first hosted execution of the 7 inside `ci-census` happens when the PR is marked ready. On `master` after merge, every non-draft PR and the merge gate runs them.

**Population side-effect:** the root config now derives **12 roots / 712 files** (was 11 / 705; the new root is `packages/domain/compatibility` with its 7 files).

### Population sanity (observation, not a gate)

A one-shot local run of the whole post-change root population (`vitest run --config vitest.config.ts`, dot reporter) collected **712 files** — the 7 B1 files included — and reported 689 passed / 23 failed files (8 failed tests, 9011 passed / 9019) in 290.9 s. **None of the 23 is a B1 file** (the failures are `packages/runtime/**` and kit suites whose local shape needs a built host/`DSH_HOME`; e.g. the first failure is an `ENFORCEMENT_UNAVAILABLE` assertion). That local run is not the census and is not used as a green claim here: the gate-relevant evidence is the targeted root-config run above (7/7 files, 76/76 tests) plus the catalogue/plan counts. What the full run does establish is the file count: the population really is 712, not 705 + an inferred delta.

## 3. Ratchet: 91 → 84, exactly

- `dev/ci/uncollected-baseline.json` was **regenerated**, not hand-edited:
  `node scripts/test-catalog.mjs --write-uncollected-baseline` → `DSH-UNCOLLECTED-BASELINE written=ok uncollected=84`.
  The file now has exactly **84 entries** and `uncollected_count: 84`; the diff is 7 row deletions and the count line (1 insertion / 43 deletions).
- The CI ratchet line was tightened, not loosened: `.github/workflows/ci-integration.yml` `--max-uncollected 91` → `--max-uncollected 84`. The check itself was not deleted and no bound was raised.
- Because the collection adds a census root, the population baseline was regenerated in the same PR (membership growth is allowed but this keeps it reviewed):
  `node scripts/census-plan.mjs --write-population-baseline --accept-population-change "batch B1: ..." --accepted-by armourpiercer1`
  → `roots=12 files=712`. The reviewed pins in `scripts/census-plan.test.mjs` (11/705 → 12/712, 22 → 24 tasks) and `scripts/census-cutover.test.mjs` (24 planned/observed, `tasks=24 roots=12`, capture assertions 12, totals 1448/1424/24) were updated to the measured values — no assertion was weakened or deleted.

Before:

```
test-catalog: UNCOLLECTED 91 · DSH-TEST-CATALOG ... refused=0 findings=0   (with --max-uncollected 91)
```

After:

```
test-catalog: UNCOLLECTED 84 · DSH-TEST-CATALOG ... refused=0 findings=0   (with --max-uncollected 84)
```

## 4. Negative control — the collected population can fail

With the real (post-change) root config, one assertion in a collected B1 file was temporarily mutated:

```diff
-    expect(result.counts.fatal).toBe(1)
+    expect(result.counts.fatal).toBe(2) // NEGATIVE CONTROL (temporary): wrong expected count
```

Red (same file, same config that now collects it):

```
 FAIL  packages/domain/compatibility/test/t5-complete-true.test.ts > P3-T5 complete:true (mandatory FATAL, no downgrade) > complete:true persona conflict -> FATAL with the exact frozen contracts-v1 code
AssertionError: expected 1 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 1

 ❯ packages/domain/compatibility/test/t5-complete-true.test.ts:68:33
 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

Then the mutation was reverted (`git checkout -- packages/domain/compatibility/test/t5-complete-true.test.ts`; `git status --porcelain` on the test directory is empty) and the same command is green again:

```
 Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  356ms
```

The red is for the right reason: the assertion that pins `complete:true` to exactly one structural FATAL is the one that fired. A collection change that could not be shown to fail this way would not be coverage.

## 5. Gates (all run on this branch, before/after the memo as noted)

| gate | command | output | exit |
| --- | --- | --- | :---: |
| catalogue ratchet | `node scripts/test-catalog.mjs --max-uncollected 84` | `UNCOLLECTED 84 … refused=0 findings=0` | 0 |
| dispatcher | `node scripts/dispatch-tests.mjs --check` | `DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=18 bad=0` | 0 |
| Required shape | `node scripts/eb3-ci-required.mjs` | `EB3-CI-REQUIRED pass workflows=10 findings=0` | 0 |
| census pins | `node --test scripts/census-plan.test.mjs` | `tests 50 · pass 50 · fail 0` | 0 |
| census cutover pins | `node --test scripts/census-cutover.test.mjs` | `tests 41 · pass 41 · fail 0` | 0 |
| docs | `node scripts/docs-sync.mjs --check` | `findings=0 blocking=0 contracts=20 pairs compared` | 0 |
| identities | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `baseline …: 76 distinct; new 0, resolved 0` | 0 |
| whitespace | `git diff --check` | (no output) | 0 |

## 6. What stays uncollected (84)

`91 − 7 = 84`, matching `dev/ci/uncollected-baseline.json`. None of the other batches moved in this PR:

| batch | files | reason it stays out |
| --- | ---: | --- |
| B2 (`tests/s2-authority/`) | 10 | separate leg (`authority-s2`); not this PR |
| B3 (`tests/world-factory/` host-free) | 31 | separate leg (`a5sf-worldfactory-c1`); not this PR |
| B4 (host-required world-factory) | 18 | **deferred by the owner**: needs the native host-asset provisioning being implemented in another PR |
| B5 (red tests to repair) | 3 | red on `master`; repairing them is its own reviewed change |
| B6 (heavy) | 3 | heavy leg (`ci-census` route for 181 s of tests) |
| B7 (`product-hygiene`) | 3 | separate leg |
| B8 (`kits-offline`) | 3 | separate leg |
| B9 (historical instruments) | 13 | archive decisions, not collection |
| **total** | **84** | |

B1 collected **all 7/7** because all 7 are green and host-free; no file was excluded, so there is no "silent skip" introduced: the 7 now execute in the same population the census grades.
