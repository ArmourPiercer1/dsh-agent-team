# B2 — collect the authority suites (`tests/s2-authority/`)

**Dated:** 2026-11-16 · **Base:** `origin/master` @ `7d1d55259` (PR #780 merged) · **Branch:** `task/b2-collect-20261116` · **Worktree:** `.worktrees/b2-collect-20261116`
**Scope:** batch **B2** of `docs/plans/memo/uncollected-audit-20261115/` (PR #777, audit merged at `4644dbe84`; B1 collected in PR #780): the 10 rows under `tests/s2-authority/`.
**Conclusion first:** **9 of the 10 are collected**, into the existing host-free `tinf-instruments` L1 leg, declared explicitly in `dev/ci/eb3-ci-manifest.json#suites[]`. Uncollected goes **84 → 75**. The tenth, `consumer-candidate.test.mjs`, is **deliberately NOT collected**: it is green standalone but reds once it runs beside a sibling suite, for a proven test-side reason (§2.2) — collecting it would import a flake into `ci-integration`. No product code changed, no new workflow job, no new Required context, no host, no test rewritten, no skip introduced.

## 1. The 10 files, measured individually before deciding

Each was **run** with the invocation it would be collected through (`node --test <file>`, which is exactly what the dispatcher spawns), not merely read. All ten are hand-rolled `t()` harnesses: the file prints `PASS`/`FAIL` per case and calls `process.exit(fails === 0 ? 0 : 1)`, so `node --test` wraps each file as **one** case whose exit code is the file's verdict.

| # | path (all under `tests/s2-authority/`) | what it verifies (from `decisions.tsv`) | safety | cases | run (warm, incl. node) | verdict |
| ---: | --- | --- | :---: | ---: | ---: | --- |
| 1 | `authority-dual-read.test.mjs` | read-only dual-read: CONF-02/03 divergence, MIS missing fields, DERIV backfill refusal, six-field positive; fixture roots only | YES:authorization | 9 | 246 ms | **green** |
| 2 | `authority-snapshot-isolated.test.mjs` | F0 canonical digest, publisher whitelist = snapshots path only, docs:sync whitelist does not expand, no pointer/registry write | YES:authorization | 30 | 182 ms | **green** |
| 3 | `candidate-track-negative-control.test.mjs` | a candidate-scoped claim NEVER satisfies a master claim (Q7 drift red stays) | YES:authorization | 4 | 101 ms | **green** |
| 4 | `ci-snapshot-reader.test.mjs` | CI reader semantics against mock providers; template read via `git show`; temp snapshot only | YES:authorization | 13 | 194 ms | **green** |
| 5 | `consumer-candidate.test.mjs` | derived-view consumer: explicit candidate mode only; default stays legacy; refusal never falls back | YES:authorization | 11 | 807 ms | **green alone, RED in the leg (§2.2) — held back** |
| 6 | `current-authority-pointer.test.mjs` | pointer load + switch transaction: precondition/digest/symlink refusals, injected failure restores EXACT previous bytes, two-current guard, missing pointer with no graph fallback | YES:authorization | 25 | 379 ms | **green** |
| 7 | `freeze-candidate.test.mjs` | candidate freeze: atomicity + digest pinning of the frozen record | partial | 12 | 3 396 ms | **green** |
| 8 | `probe-candidate.test.mjs` | candidate probe surface (read-only) | no | 7 | 1 213 ms | **green** |
| 9 | `sync-candidate-resolver.test.mjs` | candidate/resolver sync ordering + refusals | no | 8 | 1 260 ms | **green** |
| 10 | `verify-candidate.test.mjs` | candidate verification pipeline incl. digest/schema refusals (the audit's 8.4 s row) | YES:authorization | 14 | 6 102 ms | **green** |

**133 cases total, ~13.9 s serial**, all exit 0. No file was skipped, no assertion was touched.

### 1.1 Why they are uncollected today — measured, not inferred

Grepped for `s2-authority` / `authority-s2` across every surface that can make a node:test file collected:

| surface | result |
| --- | --- |
| `.github/workflows/*` | **no match**. No job, step or `node --test` argv names the directory. |
| `dev/ci/eb3-ci-manifest.json` legs (`suites[]` / `areas[]`) | **no leg names it**. The only occurrence in the whole file is prose: the `knownNonRequired` entry for `.workflows/candidate-verify.yml` says "the refusal path is tested in `tests/s2-authority/verify-candidate.test.mjs`" — a citation, not a dispatch. That job runs **no** tests. |
| `tests/checks/*.txt` (incl. `eb3-host-security-suites.txt`) | **no match**. |
| `scripts/dispatch-tests.mjs`, `scripts/test-catalog.mjs` | **no literal** (both are data-driven; the catalog *discovers* the files through the shared node:test filename predicate and reports them `UNCOLLECTED`, reason `no lane collects it`). |
| any `vitest.config.ts` / `vitest.*.mjs` | **no match**. The root config's `include[]` is `packages/**` only, and `tests/**/*.test.mjs` is not vitest's population anyway. |

So the exact reason is: **discovered by the catalog (the node:test predicate covers `tests/**/*.test.mjs`), resolved by no lane** → `UNCOLLECTED`. This is the same set-diff debt the audit describes, not a quality verdict. Confirmed by running the root config's population shape and the dispatcher: `node scripts/dispatch-tests.mjs --leg tinf-instruments --run-args` did not name any of them before this PR.

### 1.2 Host-free — proven, not asserted

Method (the audit's §3.3): hide the pinned checkout **for the test process only** with a private mount namespace, then run all ten.

```sh
EMPTY=.artifacts/tmp/empty && mkdir -p "$EMPTY"
HOST=/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use
unshare -m -r sh -c 'mount --bind "'"$PWD/$EMPTY"'" "'"$HOST"'"
  export A5SF_REQUIRE_PINNED_HOST=1 A5SF_PD31_HOST_TREE=/nonexistent
  node --test tests/s2-authority/<file>.test.mjs'
```

Measured with the tree empty (`host tree now: 0 entries`), **all ten exit 0**:

```
tests/s2-authority/authority-dual-read.test.mjs           rc=0 pass=1 fail=0
tests/s2-authority/authority-snapshot-isolated.test.mjs   rc=0 pass=1 fail=0
tests/s2-authority/candidate-track-negative-control...    rc=0 pass=1 fail=0
tests/s2-authority/ci-snapshot-reader.test.mjs            rc=0 pass=1 fail=0
tests/s2-authority/consumer-candidate.test.mjs            rc=0 pass=1 fail=0
tests/s2-authority/current-authority-pointer.test.mjs     rc=0 pass=1 fail=0
tests/s2-authority/freeze-candidate.test.mjs              rc=0 pass=1 fail=0
tests/s2-authority/probe-candidate.test.mjs               rc=0 pass=1 fail=0
tests/s2-authority/sync-candidate-resolver.test.mjs       rc=0 pass=1 fail=0
tests/s2-authority/verify-candidate.test.mjs              rc=0 pass=1 fail=0
```

**The hiding mechanism has teeth** (same namespace, a suite that needs the tree):

```
✖ tests/world-factory/a5sf-pty-contract.test.mjs (47.8ms)
Error: A5SF-PTY-CONTRACT-HOST-INCOMPLETE: the pinned host tree exists at .../tests/deepseek-harness-test-use
but is missing terminalService=..., agentRegistry=..., session=..., persistentBash=... — a partial or
older host is a pin violation (expected 639ed01539... / 0.2.0-rc.2, built)
```

Read-only import graph agrees: every file imports only `vitest`-free `node:` builtins plus `scripts/authority-*.mjs`, `scripts/current-authority.mjs`, `scripts/gen-current-state.mjs`, `scripts/freeze-candidate.mjs`, `scripts/verify-candidate.mjs`, `scripts/publish-authority.mjs`, `scripts/switch-authority.mjs`, `scripts/generated-write.mjs`, `scripts/ci-pr-gate.mjs`. The three that *mention* the host read `tests/paths.mjs` through **`git show <rev>:tests/paths.mjs`** (an object-DB read, not a checkout) — `verify-candidate.mjs:268-286` even records `dependencies.host_checkout` as PASS *because* the tree is absent. No port, no `DSH_HOME`, no boot.

## 2. The collection change (exact diff shape)

**No new leg, and that is deliberate.** The audit recommended "collect -> L1 new leg `authority-s2`". A brand-new dispatch step is structurally impossible under the current M6 parity law, which is already documented in this repo by the M7-A round:

> `scripts/dispatch-tests.mjs --parity` reports every dispatch step that had no `node --test` argv on the M6 base as UNCONVERTED, so a brand-new leg would be a permanent parity problem.
> — `dev/ci/eb3-ci-manifest.json` `tinf-instruments.why` (M7-A paragraph) and `.github/workflows/ci-integration.yml:236-239`

Measured, not argued: `node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670` compares the **pre-M6** workflow; a new step has no old-side argv, so `problems` becomes 1 and `scripts/test-catalog.test.mjs` ("the committed parity evidence still describes the resolved set") reds — that suite runs in the very leg that would carry the change. The reviewed precedent (trust-closeout's four control suites, M7-A's two slice suites) is therefore to **extend `tinf-instruments`**, and that is what this PR does.

`.github/workflows/ci-integration.yml` — comment block only (plus the ratchet):

```diff
         # ... M7-A paragraph ...
+        # B2 (2026-11-16) joins this SAME leg with NINE of the ten host-free authority suites
+        # ... (what they pin, the M6-parity reason, and why the tenth is held back) ...
+        # The ratchet below is tightened to the measured post-B2 count (84 -> 75); it may only go down.
         run: |
           node scripts/dispatch-tests.mjs --run --leg tinf-instruments
-          node scripts/test-catalog.mjs --max-uncollected 84
+          node scripts/test-catalog.mjs --max-uncollected 75
```

`dev/ci/eb3-ci-manifest.json` — nine explicit members on the existing leg (twelve before, **21** after), plus the `why` paragraph:

```diff
             "tests/world-factory/m7a-real-slice-host-state.test.mjs",
+            "tests/s2-authority/authority-dual-read.test.mjs",
+            "tests/s2-authority/authority-snapshot-isolated.test.mjs",
+            "tests/s2-authority/candidate-track-negative-control.test.mjs",
+            "tests/s2-authority/ci-snapshot-reader.test.mjs",
+            "tests/s2-authority/current-authority-pointer.test.mjs",
+            "tests/s2-authority/freeze-candidate.test.mjs",
+            "tests/s2-authority/probe-candidate.test.mjs",
+            "tests/s2-authority/sync-candidate-resolver.test.mjs",
+            "tests/s2-authority/verify-candidate.test.mjs"
           ]
```

**The exact leg/argv.** The leg id is `tinf-instruments`; the workflow step names only the leg, and the dispatcher resolves it:

```
$ node scripts/dispatch-tests.mjs --leg tinf-instruments --run-args
DSH-TEST-DISPATCH mode=inspect leg=tinf-instruments suites=21 files=21 set=sha256:a7d04943...
node --test scripts/census-aggregate.test.mjs ... scripts/test-catalog.test.mjs ...
              tests/s2-authority/authority-dual-read.test.mjs ... tests/s2-authority/verify-candidate.test.mjs
```

Executed for real in this worktree (whole leg, not a subset):

```
$ node scripts/dispatch-tests.mjs --run --leg tinf-instruments
ℹ tests 356
ℹ pass 356
ℹ fail 0
ℹ duration_ms 204053.65
DSH-TEST-DISPATCH mode=run leg=tinf-instruments suites=21 files=21 exit=0 set=sha256:a7d04943...
```

(`duration_ms` is the leg's wall clock, dominated by the census suites' vitest-shaped fixtures; the nine B2 files contribute ~14 s of it.)

**Explicit `suites[]`, not `areas[]`.** An area (`tests/s2-authority`) would auto-collect the tenth file too, and would auto-collect any future file dropped there. Since one file in that directory is now known-flaky under concurrency, the list is explicit on purpose: an unknown entry is `DISPATCH_SUITE_UNTRACKED`, an emptied declaration is `CI_LAYER_LEG_NO_SUITES`, and the workflow still names only the leg id.

### 2.1 Two pinned expectations moved (intentionally, not mechanically)

The parity **evidence** is a committed artifact (`dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt`) and `scripts/test-catalog.test.mjs` pins both its union digest and the exact allowed `added=` set. Both were regenerated **before** the test was touched:

```
$ node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670    # exit 1 by design: DIFFERS
DISPATCH-PARITY mode=inspect DIFFERS steps=18 old_files=25 new_files=40 problems=0
  union old=25 new=40 set=sha256:5e6cb47b4982251f7831e9f0380fc3f4418b34c47ac588428c19fc6539111d5c
```

`problems=0`, `missing=none` on every row. The test's `added` array then grew by exactly the nine paths (plus a comment naming the held-back tenth); it is the same law as before — parity may grow the set, it may never lose a suite, and an addition cannot hide. `node --test scripts/test-catalog.test.mjs` → **26 pass / 0 fail**.

### 2.2 Why `consumer-candidate.test.mjs` is NOT collected (the one red)

It is **green alone** (11/11) and **green with the host hidden** — so the audit's per-file measurement was right. It reds only in the shape it would actually be collected in. First observed in the full leg:

```
✖ tests/s2-authority/consumer-candidate.test.mjs (1922.8ms)
  'test failed'
FAIL C10 structure_same=false bytes_same=true
RED (1/11 failing)
DSH-TEST-DISPATCH mode=run leg=tinf-instruments suites=22 files=22 exit=1
```

Root cause, instrumented (temporary debug print, then reverted — `git status --porcelain tests/s2-authority/` is empty):

```
DEBUG C10 differs in runtime:
  A={"branch":"task/b2-collect-20261116","head":"7d1d5525...","merge_base_with_master":"7d1d5525...","merged_into_master":true,"dirty_paths":11}
  B={"branch":"task/b2-collect-20261116","head":"7d1d5525...","merge_base_with_master":"7d1d5525...","merged_into_master":true,"dirty_paths":12}
```

`C10` (line 159-185) compares `{view, findings, runtime, topLevel}` of two consecutive builds — `OLD.build(root)` (the `gen-current-state.mjs` at `5f0d0e58`, staged into `scripts/`) and the current `build(root)` — and `build()`'s `runtime` includes `dirty_paths: (git status --porcelain).length` of the **repository** (line 565/609: "live state, not persisted in the view"). `node --test` runs files concurrently; sibling suites in the same leg stage/remove temp paths inside the repo (`scripts/.tmp-gcs-baseline-*`, `.tmp-s2-*`), so the count moves between the two builds.

**Verdict: a test-side defect, not a product regression.** The product's own `renderView()` — the thing C10's byte comparison is about — deliberately excludes `runtime`; the structural comparison including it is what is unsound. It is latent on `master` today only because the file is uncollected; collecting it unchanged would make `ci-integration` intermittently red.

**Why not fix it here.** The batch is "collect green, host-free files". A repair that changes what an authority control compares is a semantic change to a safety-critical suite and belongs in its own reviewed change (the same separation the audit makes with B5, "test-side repairs, then collect"). The exact fix is one line — drop `runtime` from the structural comparison at `consumer-candidate.test.mjs:173-174` (keep `view` + `findings` + `topLevel`; `renderView` bytes are already compared separately and unaffected). It stays red-listed in `dev/ci/uncollected-baseline.json` (reason `no lane collects it`) and named in the manifest/workflow comments so it cannot be forgotten or swept in by an area.

## 3. Ratchet: 84 → 75, exactly

- `dev/ci/uncollected-baseline.json` was **regenerated, not hand-edited**:
  `node scripts/test-catalog.mjs --write-uncollected-baseline` → `DSH-UNCOLLECTED-BASELINE written=ok uncollected=75`. The file now has exactly 75 entries and `uncollected_count: 75`; the diff is **9 row deletions** + the count line (1 insertion / 55 deletions).
- `.github/workflows/ci-integration.yml`: `--max-uncollected 84` → **`75`**. Tightened, never loosened; the check itself was not deleted and no bound was raised (a deleted ratchet line is still caught by `scripts/test-catalog.test.mjs`, which reads the workflow).
- **Census population did NOT change** — no vitest config was touched: `census-plan` still derives **12 roots / 712 files**, and `census-plan.test.mjs` (50/50) and `census-cutover.test.mjs` (41/41) pass **unmodified**. `dev/ci/census-population-baseline.json` was therefore **not** regenerated (nothing to accept); unlike B1 there is no `POPULATION_GREW` event, because node:test legs are not the census population.

Before:

```
UNCOLLECTED 84 · DSH-TEST-CATALOG ... refused=0 findings=0   (with --max-uncollected 84)
```

After:

```
tests=872 instruments=3 digest=sha256:5f71c543...   (unchanged: discovery is unchanged)
DISCOVERED_AND_COLLECTED 783   (was 774)
UNCOLLECTED              75    (was 84)
DSH-TEST-CATALOG ... refused=0 findings=0
```

The catalog **digest is unchanged** because collection moves a file's classification, not its discovery — the honest measure of this PR is `collected 774 → 783` and `uncollected 84 → 75`.

## 4. Negative controls

### 4.1 The new coverage can fail — mutated collected assertion, then reverted

One assertion in a newly collected file (`authority-dual-read.test.mjs`, D1: "candidate vs graph six fields agree → exit 0, compared=6") was made wrong:

```diff
-  assert(r.compared === 6 && !r.verdicts.some((v) => v.red), JSON.stringify(r.verdicts));
+  assert(r.compared === 7 && !r.verdicts.some((v) => v.red), JSON.stringify(r.verdicts)); // NEGATIVE CONTROL (temporary)
```

Red, through the same root-config/dispatcher invocation that now collects it:

```
FAIL D1 positive: candidate vs graph six fields agree -> exit 0, compared=6: []
RED (1/9 failing)
✖ tests/s2-authority/authority-dual-read.test.mjs (173.0ms)
ℹ pass 0
ℹ fail 1
exit=1
```

Reverted (`git checkout -- tests/s2-authority/authority-dual-read.test.mjs`; `git status --porcelain tests/s2-authority/` empty), same command green again:

```
ALL GREEN (9 cases, actual count)
ℹ pass 1
ℹ fail 0
```

The red is for the right reason: the assertion that pins the six-field comparison is the one that fired. A collection whose files could not be shown to fail this way would not be coverage.

### 4.2 The ratchet still refuses a new uncollected file

A new suite was planted and staged so the catalog's `git ls-files` discovery could see it (`tests/s2-authority/b2-ratchet-probe.test.mjs`, one trivial `node:test` case; explicitly **not** in the manifest leg):

```
$ node scripts/test-catalog.mjs --max-uncollected 75
  UNCOLLECTED 76
  REFUSED UNCOLLECTED_NEW tests/s2-authority/b2-ratchet-probe.test.mjs uncollected and NOT in the reviewed baseline — this is a new suite nothing collects; collect it or add it to the baseline in a reviewed change
  REFUSED UNCOLLECTED_GREW  76 > baseline 75
DSH-TEST-CATALOG tests=873 digest=sha256:913c64c7... refused=2 findings=2
exit=2
```

Both bounds fired — the path set (`UNCOLLECTED_NEW`) and the count (`UNCOLLECTED_GREW`). Removed (`git rm --cached` + `rm`); the same command is green again at 75/`refused=0 findings=0`, exit 0.

## 5. Gates (all on this branch)

| gate | command | output | exit |
| --- | --- | --- | :---: |
| catalogue ratchet | `node scripts/test-catalog.mjs --max-uncollected 75` | `tests=872 digest=sha256:5f71c543... collected=783 uncollected=75 refused=0 findings=0` | 0 |
| dispatcher | `node scripts/dispatch-tests.mjs --check` | `DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=18 bad=0` | 0 |
| collected leg, executed | `node scripts/dispatch-tests.mjs --run --leg tinf-instruments` | `suites=21 files=21 exit=0` · `ℹ tests 356 · pass 356 · fail 0` | 0 |
| catalogue laws | `node --test scripts/test-catalog.test.mjs` | `tests 26 · pass 26 · fail 0` | 0 |
| Required shape | `node scripts/eb3-ci-required.mjs` | `EB3-CI-REQUIRED pass workflows=10 findings=0` | 0 |
| census pins | `node --test scripts/census-plan.test.mjs` | `tests 50 · pass 50 · fail 0` (12 roots / 712 files, unchanged) | 0 |
| census cutover pins | `node --test scripts/census-cutover.test.mjs` | `tests 41 · pass 41 · fail 0` | 0 |
| docs | `node scripts/docs-sync.mjs --check` | `docs=164 notes=4 plans=123(0 declaring) findings=0 blocking=0 contracts=20 pairs compared` | 0 |
| identities | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `baseline ...: 76 distinct; new 0, resolved 0` | 0 |
| whitespace | `git diff --check` | (no output) | 0 |

### 5.1 Hosted, on the draft PR (#784, run `43817908337`, head `d94177a3d`)

| job | result |
| --- | --- |
| `ci-fast` | pass 27 s |
| `ci-integration` | **pass 2 m 12 s** (the leg that now carries the nine suites) |
| `ci-security` | pass 1 m 02 s |
| `ci-product` | pass 2 m 15 s |
| `synthesize-merge-tree` | pass 19 s |
| `candidate-protection` | pass 12 s |
| `ci-census` | skipping — **draft by design** (`ci-required.yml` runs the cheap layers only; census runs on `ready_for_review`) |
| `ci-required` | **fail** — `EB3-REQUIRED fail layers=6 green=5 nongreen=ci-census:skipped`. This is the documented draft shape: a skipped census cannot satisfy branch protection, which is exactly why `required-deferred` exists. |
| `ci-required-deferred` | pass 12 s (grades the other layers) |
| `pr-settlement-gate` | fail — `DSH-SETTLEMENT-VERDICT FAIL marker=none matches=0 candidates=0 reasons=NO_SETTLEMENT_CANDIDATE`: the §8.5.6 process gate needs a dated settlement comment covering the head sha. It is not a code gate and this draft has not been reviewed/settled. |

The first hosted execution of the nine suites inside `ci-census`'s sibling layers is therefore **green**: `ci-integration` passed with the 21-suite leg on the hosted runner, not only locally.

## 6. What stays uncollected (75)

`84 − 9 = 75`, matching `dev/ci/uncollected-baseline.json`. No other batch moved:

| batch | files | reason it stays out |
| --- | ---: | --- |
| B2 remainder (`consumer-candidate`) | 1 | held back: test-side flake under the collected shape (§2.2); repair then collect |
| B3 (`tests/world-factory/` host-free) | 31 | separate collection; not this PR |
| B4 (host-required world-factory) | 18 | **deferred by the owner** (needs the native host-asset provisioning being implemented elsewhere) |
| B5 (red tests to repair) | 3 | red on `master`; repairing them is its own reviewed change |
| B6 (heavy) | 3 | heavy leg (`ci-census` route) |
| B7 (`product-hygiene`) | 3 | separate collection |
| B8 (`kits-offline`) | 3 | separate collection |
| B9 (historical instruments) | 13 | archive decisions, not collection |
| **total** | **75** | |

Nothing was skipped silently: each held-back file is either a named red with its output (§2.2) or one of the audit's own later batches, and the path set in the baseline is what the ratchet grades.

## 7. Deviations from the audit's B2 recommendation (disclosed)

1. **Leg:** audit says "collect -> L1 new leg `authority-s2`"; this PR extends the existing `tinf-instruments` leg instead, because a new dispatch step is a permanent `UNCONVERTED` under the M6 parity law (measured: `problems` would be 1, and `scripts/test-catalog.test.mjs` would red in that same leg). Same reasoning and same evidence path as M7-A. If the owner wants a dedicated leg later, the parity base/evidence must be retired first — that is its own reviewed change.
2. **Count:** audit says all 10 are green and host-free; this PR collects **9**. The tenth is green per-file but red under the collected (concurrent) shape — a defect the audit could not see because it ran files serially. It is named, root-caused, and left to its own repair.
3. **Scope/placement cost:** the nine add ~14 s to a leg whose job (`ci-integration`) measured ~89 s median, so the required run's critical path is unchanged (the census job dominates it).
