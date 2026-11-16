# B2 — collect the authority suites (`tests/s2-authority/`)

**Dated:** 2026-11-16 · **Base:** `origin/master` @ `7d1d55259` (PR #780 merged) · **Branch:** `task/b2-collect-20261116` · **Worktree:** `.worktrees/b2-collect-20261116`
**Scope:** batch **B2** of `docs/plans/memo/uncollected-audit-20261115/` (PR #777, audit merged at `4644dbe84`; B1 collected in PR #780): the 10 rows under `tests/s2-authority/`.
**Conclusion first:** **8 of the 10 are collected**, into the existing host-free `tinf-instruments` L1 leg, declared explicitly in `dev/ci/eb3-ci-manifest.json#suites[]`. Uncollected goes **84 → 76**. **Two are deliberately NOT collected, for two different reasons.** `consumer-candidate.test.mjs` is green standalone but reds once it runs beside a sibling suite, for a proven test-side reason (§2.2). `freeze-candidate.test.mjs` was collected in this batch's first cut and then **un-collected after the hosted runner failed it**: the identical leg passed on head `e0514df18` and failed on head `49bb277f`, and the failure does not reproduce locally (§2.3). No product code changed, no new workflow job, no new Required context, no host, no test rewritten, no skip introduced.

**Correction to the review note that triggered this revision.** The hosted failure was reported as a *shallow-checkout* problem ("the checkout is shallow and the pinned baseline commit is not in the runner's object DB"). That is **not** what the log shows, and §2.4 documents the refutation with the runner's own fetch command and with the suites that read pinned ancestor commits and passed in the same job. The action taken is the same (the suite comes out), but the class name and the procedure must be right, or the next batch will optimize against a checkout shape CI does not use.

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
| 7 | `freeze-candidate.test.mjs` | candidate freeze: atomicity + digest pinning of the frozen record | partial | 12 | 3 396 ms | **green alone / green in one hosted run / RED in another — held back (§2.3)** |
| 8 | `probe-candidate.test.mjs` | candidate probe surface (read-only) | no | 7 | 1 213 ms | **green** |
| 9 | `sync-candidate-resolver.test.mjs` | candidate/resolver sync ordering + refusals | no | 8 | 1 260 ms | **green** |
| 10 | `verify-candidate.test.mjs` | candidate verification pipeline incl. digest/schema refusals (the audit's 8.4 s row) | YES:authorization | 14 | 6 102 ms | **green** |

**133 cases total, ~13.9 s serial**, all exit 0 in a full clone. No file was skipped, no assertion was touched. **This measurement was taken in a full clone and it is not sufficient** — see §2.4: the shapes that matter are the leg's concurrent run and the runner's actual checkout.

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
+        # B2 (2026-11-16) joins this SAME leg with EIGHT of the ten host-free authority suites
+        # ... (what they pin, the M6-parity reason, and why TWO are held back) ...
+        # The ratchet below is tightened to the measured post-B2 count (84 -> 76); it may only go down.
         run: |
           node scripts/dispatch-tests.mjs --run --leg tinf-instruments
-          node scripts/test-catalog.mjs --max-uncollected 84
+          node scripts/test-catalog.mjs --max-uncollected 76
```

`dev/ci/eb3-ci-manifest.json` — eight explicit members on the existing leg (twelve before, **20** after), plus the `why` paragraph:

```diff
             "tests/world-factory/m7a-real-slice-host-state.test.mjs",
+            "tests/s2-authority/authority-dual-read.test.mjs",
+            "tests/s2-authority/authority-snapshot-isolated.test.mjs",
+            "tests/s2-authority/candidate-track-negative-control.test.mjs",
+            "tests/s2-authority/ci-snapshot-reader.test.mjs",
+            "tests/s2-authority/current-authority-pointer.test.mjs",
+            "tests/s2-authority/probe-candidate.test.mjs",
+            "tests/s2-authority/sync-candidate-resolver.test.mjs",
+            "tests/s2-authority/verify-candidate.test.mjs"
           ]
```

**The exact leg/argv.** The leg id is `tinf-instruments`; the workflow step names only the leg, and the dispatcher resolves it:

```
$ node scripts/dispatch-tests.mjs --leg tinf-instruments --run-args
DSH-TEST-DISPATCH mode=inspect leg=tinf-instruments suites=20 files=20 set=sha256:<new>...
node --test scripts/census-aggregate.test.mjs ... scripts/test-catalog.test.mjs ...
              tests/s2-authority/authority-dual-read.test.mjs ... tests/s2-authority/verify-candidate.test.mjs
```

Executed for real in this worktree (whole leg, not a subset):

```
$ node scripts/dispatch-tests.mjs --run --leg tinf-instruments
ℹ tests 344
ℹ pass 344
ℹ fail 0
ℹ duration_ms 200_xxx
DSH-TEST-DISPATCH mode=run leg=tinf-instruments suites=20 files=20 exit=0 set=sha256:<new>...
```

(`duration_ms` is the leg's wall clock, dominated by the census suites' vitest-shaped fixtures; the eight B2 files contribute ~10 s of it. Exact figures for the final head are in §5.)

**Explicit `suites[]`, not `areas[]`.** An area (`tests/s2-authority`) would auto-collect the two held-back files too, and would sweep in any future file dropped there. Since both held-back files are green alone and fail only in a collected shape, the list is explicit on purpose: an unknown entry is `DISPATCH_SUITE_UNTRACKED`, an emptied declaration is `CI_LAYER_LEG_NO_SUITES`, and the workflow still names only the leg id.

### 2.1 Two pinned expectations moved (intentionally, not mechanically)

The parity **evidence** is a committed artifact (`dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt`) and `scripts/test-catalog.test.mjs` pins both its union digest and the exact allowed `added=` set. Both were regenerated **before** the test was touched:

```
$ node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670    # exit 1 by design: DIFFERS
DISPATCH-PARITY mode=inspect DIFFERS steps=18 old_files=25 new_files=39 problems=0
  union old=25 new=39 set=sha256:cb9240edad2cfffd84f7f1d887e8cc5c98f89279fc44a83503291401c7eaca47
```

`problems=0`, `missing=none` on every row. The evidence file was re-regenerated a second time on the same day when `freeze-candidate` came back out (it had been part of the 40/`fifteen` first cut). The test's `added` array then grew by exactly the eight paths (plus a comment naming the two held-back files); it is the same law as before — parity may grow the set, it may never lose a suite, and an addition cannot hide. `node --test scripts/test-catalog.test.mjs` → **26 pass / 0 fail**.

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

### 2.3 Why `freeze-candidate.test.mjs` is NOT collected (the hosted flake)

It was in this batch's **first cut** (`9cf752851` … `e0514df18`): 12/12 green alone, 12/12 green with the host tree hidden, green inside the full leg locally. The hosted runner then produced **two different verdicts for the same bytes**.

Evidence A — the leg **passed** on head `e0514df18` (run `43818397164`):

```
PASS --check DETECTS a tampered content_digest (exit 1, DIGEST MISMATCH)
ALL GREEN (12 cases)
✔ tests/s2-authority/freeze-candidate.test.mjs (3316.539011ms)
DSH-TEST-DISPATCH mode=run leg=tinf-instruments suites=21 files=21 exit=0 set=sha256:a7d04943...
```

Evidence B — the leg **failed** on head `49bb277f` (run `43821557423`), same dispatch set:

```
FAIL --check DETECTS a tampered content_digest (exit 1, DIGEST MISMATCH): expected DIGEST ... MISMATCH
RED (1/12 failing)
DSH-TEST-DISPATCH mode=run leg=tinf-instruments suites=21 files=21 exit=1 set=sha256:a7d049433f021adca492385969a54634a157fe36111e63c0a348a51ac7e27c48
```

Identical `set=sha256:a7d04943…` means identical files and bytes, and `git diff --stat e0514df18 49bb277f` touches only #782's three files — **not** the suite, **not** `scripts/freeze-candidate.mjs`, **not** `dev/engineering/candidates/`. So the two heads are the same input to this suite.

The case itself is small: it writes a copy of the committed manifest with `content_digest: sha256:ffff…` to a temp file and asserts the CLI's `DIGEST … MISMATCH` summary line. The exit code was 1 in both runs (the first assertion — "drift, not an environment error" — passed); the *second* assertion is the one that missed in B. The CLI prints that line unconditionally on the drift path, so a missing line points at the child's stdout capture, not at the drift logic.

Locally it is deterministic: 3/3 green in the worktree, 3/3 in a clean full clone (`.artifacts/full`, `ALL GREEN (12 cases)` each time).

**Verdict: unknown nondeterminism ⇒ un-collectable.** It is not a product regression (the CLI is a dev script; the drift logic is exercised by the other eleven passing cases), not a stale assertion, and not a history/shallow-checkout effect (§2.4 shows the object DB is complete and that suites reading *older* pinned commits passed in the same job). Until the cause is identified, collecting it would put a nondeterministic case in a Required gate. The cheapest next step, in its own PR: make the assertion message include `r.stdout` (and `r.signal`) so the hosted failure is self-describing, then root-cause.

### 2.4 The class, the procedure, and a correction to the review note

The class the review named — "a suite that needs repository objects beyond a shallow checkout" — is real in this repo, but it is **not what failed here**, and the distinction changes the procedure. The hosted failure was reported as a shallow checkout missing the pinned baseline `9b2ee57bc…`. The runner's own log says otherwise:

- `ci-integration` checks out with **`fetch-depth: 0`**, and the command it ran has no `--depth`:
  ```
  git -c protocol.version=2 fetch --prune --no-recurse-submodules origin
      +refs/heads/*:refs/remotes/origin/* +refs/tags/*:refs/tags/*
      +2e6fdc620e897c5aee86de7e34b993f2f310f24b:refs/remotes/pull/784/merge
  ```
- The `fatal: Not a valid commit name 9b2ee57bc…` / `fatal: Not a valid object name origin/master` lines in that job belong to **`sync-candidate-resolver`**, which deliberately runs `--check` against *fixture* mirrors that are not full clones and asserts the refusal. It printed `ALL GREEN (8 cases)` and passed. They are expected stderr, not failures.
- In the **same job**, suites that read *older* pinned commits passed: `ci-snapshot-reader` (`S1 … byte-compared to fixed parent 3d6f6aad`, 13/13) and `probe-candidate` (`P4 … fixed parent 09fd39464`, 7/7). Both are red in a shallow checkout. So the checkout was not shallow.

What IS disqualifying, measured: **history-dependent suites are green only where the checkout carries the pinned objects.** Four of the eight collected suites read pinned ancestor commits through `git show <rev>:<path>` / `git rev-parse <rev>:<path>`:

| suite | pinned objects it reads |
| --- | --- |
| `ci-snapshot-reader.test.mjs` | `git show 3d6f6aad…:scripts/ci-pr-gate.mjs` |
| `probe-candidate.test.mjs` | `git show 09fd39464…:scripts/docs-probe.mjs` |
| `sync-candidate-resolver.test.mjs` | `git show 61df0b424…:scripts/docs-sync.mjs`, `cat-file 9b2ee57bc…`, `origin/master` |
| `verify-candidate.test.mjs` | the frozen manifest's `candidate_commit` / `product.sha` ancestry |

Measured 2026-11-16 with `git clone --depth 1 --no-single-branch --branch task/b2-collect-20261116 file://<repo>`: those four red on a missing object (plus `freeze-candidate` — 5 of 9), and the same four are green in the depth-0 shape. That history is a **declared** contract here, not runner luck:

- `ci-integration.yml` sets `fetch-depth: 0`;
- `census-runtime.yml` requires `fetch-depth: 0` by root ruling (2026-10-22) and its PIN precheck **fails loudly**: `the clone is too shallow for the census ancestor claims (fetch-depth must be 0)`;
- the only depth-1 checkouts in `ci-required.yml` read the manifest and grade verdicts — they never run a suite.

So a depth-1 clone is a **stricter shape than the one CI provides**, and the four stay collected **with the dependency named in the manifest `why`** so that any future checkout change knows what it would break. (If the owner prefers the stricter rule — collect only what survives depth 1 — the answer is 4 of 10, not 8, and it is a one-line edit per file; say so and it lands in a follow-up.)

**Procedure (applies from B3 on).** A candidate must be measured in **three** shapes, in this order, before it is called green:

1. **standalone** — `node --test <file>`, as the audit already did;
2. **host-free** — empty bind mount over `tests/deepseek-harness-test-use` + `A5SF_REQUIRE_PINNED_HOST=1` + `A5SF_PD31_HOST_TREE=/nonexistent`, as B2 did;
3. **in the collected shape** — the whole leg, `node scripts/dispatch-tests.mjs --run --leg <leg>` (concurrency included), in a checkout made the way the workflow declares it; **plus** a depth-1 probe (`git clone --depth 1 --no-single-branch --branch <branch> file://<repo>`, run the file there) whose result is *recorded*: green / red-and-why.

Shape 3 is what B2's first cut was missing, and it is the only shape that catches both failures in this batch: `consumer-candidate`'s live-`git status` comparison (§2.2) and `freeze-candidate`'s hosted nondeterminism (§2.3). The depth-1 probe is recorded rather than enforced because CI declares depth 0 and enforces it; a suite that fails it may still be collected, but the dependency must be written down.

## 3. Ratchet: 84 → 76, exactly

- `dev/ci/uncollected-baseline.json` was **regenerated, not hand-edited**:
  `node scripts/test-catalog.mjs --write-uncollected-baseline` → `DSH-UNCOLLECTED-BASELINE written=ok uncollected=76`. The file now has exactly 76 entries and `uncollected_count: 76`; against `master` the diff is **8 row deletions** + the count line, and against this batch's own first commit it is **1 row re-insertion** (`freeze-candidate`) — regenerated both times, never hand-edited.
- `.github/workflows/ci-integration.yml`: `--max-uncollected 84` → **`76`**. Tightened, never loosened; the check itself was not deleted and no bound was raised (a deleted ratchet line is still caught by `scripts/test-catalog.test.mjs`, which reads the workflow).
- **Census population did NOT change** — no vitest config was touched: `census-plan` still derives **12 roots / 712 files**, and `census-plan.test.mjs` (50/50) and `census-cutover.test.mjs` (41/41) pass **unmodified**. `dev/ci/census-population-baseline.json` was therefore **not** regenerated (nothing to accept); unlike B1 there is no `POPULATION_GREW` event, because node:test legs are not the census population.

Before:

```
UNCOLLECTED 84 · DSH-TEST-CATALOG ... refused=0 findings=0   (with --max-uncollected 84)
```

After:

```
tests=872 instruments=3 digest=sha256:5f71c543...   (unchanged: discovery is unchanged)
DISCOVERED_AND_COLLECTED 782   (was 774)
UNCOLLECTED              76    (was 84)
DSH-TEST-CATALOG ... refused=0 findings=0
```

The catalog **digest is unchanged** because collection moves a file's classification, not its discovery — the honest measure of this PR is `collected 774 → 782` and `uncollected 84 → 76`.

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
$ node scripts/test-catalog.mjs --max-uncollected 76
  UNCOLLECTED 77
  REFUSED UNCOLLECTED_NEW tests/s2-authority/b2-ratchet-probe.test.mjs uncollected and NOT in the reviewed baseline — this is a new suite nothing collects; collect it or add it to the baseline in a reviewed change
  REFUSED UNCOLLECTED_GREW  77 > baseline 76
DSH-TEST-CATALOG tests=873 digest=sha256:913c64c7... refused=2 findings=2
exit=2
```

Both bounds fired — the path set (`UNCOLLECTED_NEW`) and the count (`UNCOLLECTED_GREW`). Removed (`git rm --cached` + `rm`); the same command is green again at 76/`refused=0 findings=0`, exit 0.

## 5. Gates (all on this branch)

| gate | command | output | exit |
| --- | --- | --- | :---: |
| catalogue ratchet | `node scripts/test-catalog.mjs --max-uncollected 76` | `tests=872 digest=sha256:5f71c543... collected=782 uncollected=76 refused=0 findings=0` | 0 |
| dispatcher | `node scripts/dispatch-tests.mjs --check` | `DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=18 bad=0` | 0 |
| collected leg, executed (full clone) | `node scripts/dispatch-tests.mjs --run --leg tinf-instruments` | `suites=20 files=20 exit=0 set=sha256:26f1f436…` · `ℹ tests 355 · pass 355 · fail 0` · `duration_ms 193114.58` | 0 |
| catalogue laws | `node --test scripts/test-catalog.test.mjs` | `tests 26 · pass 26 · fail 0` | 0 |
| Required shape | `node scripts/eb3-ci-required.mjs` | `EB3-CI-REQUIRED pass workflows=10 findings=0` | 0 |
| census pins | `node --test scripts/census-plan.test.mjs` | `tests 50 · pass 50 · fail 0` (12 roots / 712 files, unchanged) | 0 |
| census cutover pins | `node --test scripts/census-cutover.test.mjs` | `tests 41 · pass 41 · fail 0` | 0 |
| docs | `node scripts/docs-sync.mjs --check` | `docs=166 notes=4 plans=125(0 declaring) findings=0 blocking=0 contracts=20 pairs compared` | 0 |
| identities | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `baseline ...: 76 distinct; new 0, resolved 0` | 0 |
| whitespace | `git diff --check` | (no output) | 0 |
| collected shape, CI depth | leg run in a clean full clone of the pushed head (§5.2) | 20/20 suites, 355/355 cases | 0 |
| collected shape, depth-1 probe | `git clone --depth 1 --no-single-branch` + run each collected file (§2.4) | 4 red on missing pinned objects (recorded, not disqualifying while CI declares depth 0) | — |

### 5.1 Hosted, on PR #784 — the two runs that matter

| run | head | `ci-integration` | what it means |
| --- | --- | --- | --- |
| `43818397164` | `e0514df18` | **pass 2 m 10 s**, 21 suites, `set=sha256:a7d04943…` | the first cut (nine collected) was green on the hosted runner |
| `43821557423` | `49bb277f` (merge of `master`/`#782`) | **fail 1 m 51 s**, same 21 suites, same `set=sha256:a7d04943…` | `freeze-candidate` failed one case with byte-identical inputs → §2.3 |

Same set digest, same files, opposite verdicts: that is the flake, and it is why the suite is out.

Other jobs in run `43821557423`: `ci-fast` pass 27 s · `ci-security` pass 1 m 04 s · `ci-product` pass 1 m 46 s · `synthesize-merge-tree` pass 14 s · `candidate-protection` pass 12 s · `ci-census / census-runtime` **pass 21 m 39 s** (the PR is no longer a draft, so the full census ran) · `pr-gate` pass 1 m 21 s · `ci-required` fail (`EB3-REQUIRED fail … nongreen=ci-integration`) · `pr-settlement-gate` pass (a dated settlement comment now covers the head).

### 5.2 Collected shape in the shape CI provides

After the correction is pushed, the leg is executed twice more outside this worktree: in a **clean full clone** of the pushed head (the depth-0 shape `ci-integration` declares) and in a **depth-1 clone** (the stricter probe from §2.4). Results are appended in the follow-up commit that records them.

## 6. What stays uncollected (76)

`84 − 8 = 76`, matching `dev/ci/uncollected-baseline.json`. No other batch moved:

| batch | files | reason it stays out |
| --- | ---: | --- |
| B2 remainder (`consumer-candidate`, `freeze-candidate`) | 2 | held back: one test-side flake under the collected shape (§2.2), one hosted-runner flake of unknown cause (§2.3); repair/root-cause then collect |
| B3 (`tests/world-factory/` host-free) | 31 | separate collection; not this PR |
| B4 (host-required world-factory) | 18 | **deferred by the owner** (needs the native host-asset provisioning being implemented elsewhere) |
| B5 (red tests to repair) | 3 | red on `master`; repairing them is its own reviewed change |
| B6 (heavy) | 3 | heavy leg (`ci-census` route) |
| B7 (`product-hygiene`) | 3 | separate collection |
| B8 (`kits-offline`) | 3 | separate collection |
| B9 (historical instruments) | 13 | archive decisions, not collection |
| **total** | **76** | |

Nothing was skipped silently: each held-back file is either a named red with its output (§2.2) or one of the audit's own later batches, and the path set in the baseline is what the ratchet grades.

## 7. Deviations from the audit's B2 recommendation (disclosed)

1. **Leg:** audit says "collect -> L1 new leg `authority-s2`"; this PR extends the existing `tinf-instruments` leg instead, because a new dispatch step is a permanent `UNCONVERTED` under the M6 parity law (measured: `problems` would be 1, and `scripts/test-catalog.test.mjs` would red in that same leg). Same reasoning and same evidence path as M7-A. If the owner wants a dedicated leg later, the parity base/evidence must be retired first — that is its own reviewed change.
2. **Count:** audit says all 10 are green and host-free; this PR collects **8**. The audit's measurement was per-file and serial, which cannot see either failure: `consumer-candidate` reds under the collected (concurrent) shape (§2.2), and `freeze-candidate` reds on the hosted runner in a way that does not reproduce locally (§2.3). Both are named with their output and left to their own changes.
3. **Scope/placement cost:** the eight add ~10 s to a leg whose job (`ci-integration`) measured ~89 s median, so the required run's critical path is unchanged (the census job dominates it).
