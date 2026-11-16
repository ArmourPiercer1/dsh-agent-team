# B3 — collect the 28 measured host-free world-factory suites (75 → 47 on the B2 base)

**Dated:** 2026-11-16 · **Branch:** `task/b3-collect-20261116` · **Worktree:** `.worktrees/b3-collect-20261116`
**Base:** `origin/master` @ `7d1d55259` (B1 merged) **+ a merge of `task/b2-collect-20261116` @ `e0514df18`** (draft PR #784, not yet merged — see §0.1), so this branch's own floor is B2's `75` uncollected.
**Scope:** batch **B3** of `docs/plans/memo/uncollected-audit-20261115/` (PR #777, audit at `4644dbe84`): the world-factory suites the audit classified "host-free green".
**Conclusion first:** of the audit's 31 B3 files, **28 are green with the pinned host tree absent** and are collected by appending them to the **existing** `tinf-instruments` leg's `suites[]` — no new workflow, no new job, no new leg, no new Required context, no test rewritten. **3 are not collectable as-is** and stay uncollected with their measured red output below. Uncollected goes **75 → 47** on this base (`84 → 56` for B3 alone against master); the ratchet is tightened 75 → 47. The leg now **declares and sets `A5SF_REQUIRE_PINNED_HOST=1`**, so an absent host is a red, never a `NOT_RUN`; `eb3-ci-required` grades both halves so the trap cannot recur silently. Both required negative controls are quoted verbatim.

## 0. Review round 1 — what changed, and why

Review of the first revision found two structural blocks (both fair) and one trap I had measured but not deployed. All three are fixed here; everything else (§3's table, the split, the ratchet, the red control) is unchanged.

### 0.1 BLOCK 2 — a new leg was a permanent parity problem; reshaped onto `tinf-instruments`

Revision 1 introduced `dispatch_id: "a5sf-worldfactory-c1"` as a **new leg** and disclosed `--parity` `problems` 18 → 19 as "a migration report, not a gate". That was wrong twice over. The pinned law compares against **`e5bf05670`** (the last commit whose workflows still carry the hand-written `node --test` lists), and a brand-new dispatch step has no old-side argv there:

```
$ node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670     # revision 1
DISPATCH-PARITY … problems=1
  UNCONVERTED step a5sf world-factory C1
```

and `scripts/test-catalog.test.mjs` **pins** that evidence file, so "not a gate" was false. The manifest's own M7-A and B2 rationales say exactly why this shape is forbidden: *"a brand-new leg would be a permanent parity problem"*. Measured after the reshape:

```
$ node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670
DISPATCH-PARITY mode=inspect DIFFERS steps=18 old_files=25 new_files=68 problems=0
  union old=25 new=68 set=sha256:dce31a7fef2962b73645b80bb93aece714e077fdc5709d5851ee63f77485145f
```

The 28 are now appended to `tinf-instruments`' `suites[]` **after B2's nine**, and `dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt` is regenerated deliberately (every row `missing=none`, `problems=0`), with `scripts/test-catalog.test.mjs`'s pinned `added=` set grown by exactly these 28 paths (43 entries = 4 trust-closeout controls + M7-A's 2 + B2's 9 + these 28).

**Coordination (#784 was still open).** `task/b2-collect-20261116` had not merged when this revision was written (open draft, head `e0514df18`), so — as instructed — this branch **merges** it and appends after its entries. The B2 commits are therefore in this branch's history until #784 merges; `git diff origin/task/b2-collect-20261116` shows only B3's changes. Nothing of B2's was altered: its 9 `s2-authority` suites, its baseline, its memo and its parity rows are untouched.

### 0.2 BLOCK 1 — `scripts/test-catalog.test.mjs` is now in every gate list

Revision 1's gate table omitted the suite that pins the parity evidence, and it was red (`26 tests / 25 pass / 1 fail`, `sha256:fd6716ca…` vs committed `949f6499…`). It is suite #1 of the `tinf-instruments` leg, runs in `ci-integration.yml`, and `ci-required` needs `ci-integration` — so revision 1 was red on the Required layer. It is green now and it is part of the gate list from here on (§9):

```
$ node --test scripts/test-catalog.test.mjs
ℹ tests 26   ℹ pass 26   ℹ fail 0
```

### 0.3 HIGH — the `NOT_RUN` trap is now declared, set and graded

Revision 1 measured the trap and wrote it in prose only. `hostFree` does **not** enforce `legs[].suites` (`checkSuiteLists` only grades `layer.suiteList`, and `ci-integration` has none), so a `pty-contract`-class suite in that leg would exit **0** with `verdict=NOT_RUN` while `eb3-ci-required` still said `pass workflows=10 findings=0`. Now:

1. the **manifest leg** declares `"env": {"A5SF_REQUIRE_PINNED_HOST": "1"}`;
2. the **workflow step** sets the same value (`env:` at step level, not an inline assignment — the leg-assignment allowlist is untouched);
3. **two new graded rules** close the recurrence:
   * `CI_LAYER_LEG_ENV_MISSING` — a leg's declared `env` must appear, with the same value, on the step that EXECUTES that leg (the same declaration-grades-the-step law `cmd`/`check[]` already had);
   * `CI_HOST_REFUSAL_UNGUARDED` — a `hostFree` layer's leg listing a suite that consults `A5SF_REQUIRE_PINNED_HOST` must either set that env to `1` or declare the reviewed exception `hostRefusal: 'declared-not-run'`.
4. the **one pre-existing exception** is now named rather than silent: `a5sf-fs-contract-layer-b` carries `hostRefusal: 'declared-not-run'`, because that lane deliberately provisions no host and its suite reports `A5SF-FS-CONTRACT-HOST-REFUSED` for a declared NOT_RUN.

Both rules are negative-controlled (`C10b`, `C10c` in `scripts/eb3-ci-negative-controls.mjs`, 26 → 28 controls). The flag-in-place control is §6.2: with the flag, the same suite is **red**; without it, **`NOT_RUN`**.

### 0.4 MED — the repair site is `packages/runtime/package.json`, on three packages

Revision 1 named "two packages, or fix the root manifest". Both are wrong. `a5sf-pd14-sandbox-root` resolves **three** names it never declares (`@deepseek-ai/dsh-sandbox-policy` at `:102`, `@deepseek-ai/dsh-sandbox-local` at `:103`, plus `@deepseek-ai/dsh-persona` from `governed-preset`), and **none of the three is declared in `packages/runtime/package.json` or in the root manifest** — the root manifest is not a resolution site for them at all, because the suites `runtimeRequire.resolve(...)` **from `packages/runtime`**. The audit's green came from `NODE_PATH=<repo>/node_modules/.pnpm/node_modules`, which injects pnpm's hoist; no workflow sets it. The correct repair is `packages/runtime/package.json` **`devDependencies` on all three**, which is a manifest + lockfile change and belongs in its own reviewed PR. §4 states this.

## 1. What B3 was, and why it had to be re-measured

The audit's rev-2 header records the reason this batch cannot be taken on trust:

> **Rev 2** after review of PR #777: rev 1's "host-free" claim was **wrong for 18 files**. It said 37 files run host-free in the `a5sf-worldfactory-c1` leg; the measurement in §4 gives **31**, and 18 moved to a host-provisioned leg (§6.1).

The defect was mechanical, not editorial: these files live under `tests/world-factory/` and resolve the pristine checkout through `tests/paths.mjs#findTestRepoRoot()`, which walks **up** from the worktree. A test worktree at `…/dsh-agent-team/.worktrees/<task>` therefore finds the **main checkout's** `tests/deepseek-harness-test-use` and goes green — in a directory it never names. "Green here" was reading the developer's machine.

## 2. Method (re-runnable)

1. **Clean install, in the CI shape.** The worktree had no `node_modules`, and a checkout without one reds these suites for the *wrong* reason (`Cannot find module '@deepseek-ai/cordis'` — an environment fact, not a host fact). Installed exactly as `ci-integration` does:
   `pnpm install --offline --frozen-lockfile --store-dir .worktrees/pnpm-store` (pnpm 11.7.0, the version the workflow pins). **No `NODE_PATH`** — this matters; see §4.1.
2. **Host absent, private mount namespace.** The tree that `findTestRepoRoot()` actually reaches from this worktree is the main checkout's, so *that* is the path to remove:

   ```sh
   EMPTY=.artifacts/tmp/empty && mkdir -p "$EMPTY"
   unshare -m -r sh -c '
     mount --bind "'"$PWD/$EMPTY"'" /home/armourpiercer/projects/dsh-agent-team/tests
     export A5SF_REQUIRE_PINNED_HOST=1 A5SF_PD31_HOST_TREE=/nonexistent
     node --test <file>
   '
   ```

   Binding the parent `tests/` empty makes the checkout **genuinely absent** (not present-but-empty, which is the *harder* failure: `A5SF-PTY-CONTRACT-HOST-INCOMPLETE … a partial or older host is a pin violation`). `A5SF_REQUIRE_PINNED_HOST=1` turns a declared refusal into a failure so a suite cannot turn red into "skipped"; `A5SF_PD31_HOST_TREE=/nonexistent` defeats the main-checkout fallback.
3. **Collected-anywhere-today** for all 31: `git show HEAD:` over every `.github/workflows/*`, `dev/ci/eb3-ci-manifest.json`, `scripts/dispatch-tests.mjs`, `dev/ci/test-contracts.json` and `tests/checks/*` → **0 mentions of any of the 31 paths**. They were strictly uncollected, not duplicate-collected.
4. Full sweep rows are in §3. Every "green" below is an exit code plus a `ℹ pass/fail/skipped` line, not an inference.

Measured environment note: the sweep was re-run from scratch after the install, because the first pass (no `node_modules`) produced nine *load* failures that look like host failures and are not.

## 3. The 31 B3 files, measured with the host absent

`arms` = `ℹ tests`; `skip` = `ℹ skipped`. All rows: `rc=0` unless marked. Every row: **collected anywhere today = no (0 declarations)**.

| # | file (`tests/world-factory/…`) | arms | pass | skip | host-absent verdict | collected |
| ---: | --- | ---: | ---: | ---: | --- | :---: |
| 1 | `a5sf-acceptance-preflight.test.mjs` | 73 | 73 | 0 | green, host-free | **yes** |
| 2 | `a5sf-assembly.test.mjs` | 35 | 35 | 0 | green, host-free | **yes** |
| 3 | `a5sf-ask-precedence.test.mjs` | 4 | 4 | 0 | green, host-free | **yes** |
| 4 | `a5sf-bash.test.mjs` | 21 | 21 | 0 | green, host-free | **yes** |
| 5 | `a5sf-capability-defaults.test.mjs` | 3 | 3 | 0 | green, host-free | **yes** |
| 6 | `a5sf-dev-live-slots.test.mjs` | 9 | 9 | 0 | green, host-free (imports the pinned **SHA constant** only) | **yes** |
| 7 | `a5sf-dev-live.test.mjs` | 15 | 15 | 0 | green, host-free (same) | **yes** |
| 8 | `a5sf-dual-plane.test.mjs` | 53 | 53 | 0 | green, host-free | **yes** |
| 9 | `a5sf-instrument-graph.test.mjs` | 7 | 7 | 0 | green, host-free | **yes** |
| 10 | `a5sf-p01-realm-binding.test.mjs` | 9 | 9 | 0 | green, host-free | **yes** |
| 11 | `a5sf-pd1-revocation-escape.test.mjs` | 5 | 5 | 0 | green, host-free | **yes** |
| 12 | `a5sf-pd12-bash-governance.test.mjs` | 8 | 7 | 1 | green, host-free (1 **declared** PRE-FIX defect-pin skip) | **yes** |
| 13 | `a5sf-pd13-terminal-read-axis.test.mjs` | 13 | 12 | 1 | green, host-free (1 declared PRE-FIX pin) | **yes** |
| 14 | `a5sf-pd26-confined-skill.test.mjs` | 6 | 2 | 4 | green, host-free (4 declared PIN/FORK skips) | **yes** |
| 15 | `a5sf-pd29-goal-stop.test.mjs` | 4 | 4 | 0 | green, host-free | **yes** |
| 16 | `a5sf-pd33-preview-e2e.test.mjs` | 14 | 14 | 0 | green, host-free | **yes** |
| 17 | `a5sf-pd34-member-stop.test.mjs` | 8 | 8 | 0 | green, host-free | **yes** |
| 18 | `a5sf-run-record-binding.test.mjs` | 6 | 6 | 0 | green, host-free | **yes** |
| 19 | `a5sf-search-live.test.mjs` | 52 | 52 | 0 | green, host-free | **yes** |
| 20 | `a5sf-window-taxonomy.test.mjs` | 9 | 9 | 0 | green, host-free | **yes** |
| 21 | `arm-verdict.test.mjs` | 17 | 17 | 0 | green, host-free | **yes** |
| 22 | `binding-digests.test.mjs` | 14 | 14 | 0 | green, host-free | **yes** |
| 23 | `port-probe.test.mjs` | 5 | 5 | 0 | green, host-free (6.1 s, own bound: 3080/3180 asserted out of range) | **yes** |
| 24 | `u6-arc-d.test.mjs` | 8 | 8 | 0 | green, host-free | **yes** |
| 25 | `u7-tbash-offline-drive.test.mjs` | 1 | 1 | 0 | green, host-free | **yes** |
| 26 | `u7-tbash-seam.test.mjs` | 9 | 9 | 0 | green, host-free | **yes** |
| 27 | `u7-tbash.test.mjs` | 8 | 8 | 0 | green, host-free | **yes** |
| 28 | `u7-uileg0-answer-drive.test.mjs` | 10 | 10 | 0 | green, host-free | **yes** |
| 29 | `a5sf-governed-preset.test.mjs` | 17 | 16 | 0 | **RED** — install-shape, not host (§4.1) | no |
| 30 | `a5sf-pd14-sandbox-root.test.mjs` | 1 | 0 | 0 | **RED (module load)** — install-shape, not host (§4.2) | no |
| 31 | `a5sf-debt-register.test.mjs` | 10 | 9 | 0 | **RED** — stale product-debt anchor (§4.3) | no |

**Totals:** 28 collected files = **426 arms, 420 pass, 0 fail, 6 declared skips, ~11.6 s serial** (the leg runs them concurrently — the whole 49-suite leg is 215.6 s, of which the 28 new files are ~6.5 s). The 6 skips are all source-declared "PRE-FIX / PIN / FORK" arms and are identical with the host **present** — verified by re-running `pd26` (4), `pd12` (1) and `pd13` (1) host-present: same counts, same titles. They are not host-absence skips, which is the only kind that would make a green vacuous.

**Split vs the audit:** the audit's B3 said 31 host-free / B4 18 host-dependent. Measured: **28 green host-free, 3 host-independent red** (they are *not* B4 either — removing the host changes nothing for them). The 18-file B4 host-dependent set was confirmed by the same method on a sample (§6) and is untouched here.

## 4. The three that are not collectable as-is (measured, not inferred)

All three are red **with or without** the host tree absent — i.e. host absence is not the cause.

### 4.1 `a5sf-governed-preset` — red in the CI install shape

```
✖ G0 the shipped preset is declared, opt-in, shell-free, PD-18 closed and resolvable (12.316817ms)
  AssertionError [ERR_ASSERTION]: Got unwanted exception: @deepseek-ai/dsh-persona (persona) must resolve
    actual: Error: Cannot find module '@deepseek-ai/dsh-persona'
```

G0 asserts that every plugin name in the shipped governed preset resolves from `packages/runtime`'s manifest. `@deepseek-ai/dsh-persona` is **not a declared dependency** of `packages/runtime`; pnpm's isolated linker installs it only into `node_modules/.pnpm/node_modules`. It resolves only if `NODE_PATH` injects that hoist — which is exactly what the audit's hand-linked worktree did:

```
# same file, host absent, with NODE_PATH=<root>/node_modules/.pnpm/node_modules
ℹ tests 17   ℹ pass 17   ℹ fail 0   ℹ skipped 0
```

`ci-integration` sets no `NODE_PATH`, so under the real install this is red. Collecting it would red the layer.

### 4.2 `a5sf-pd14-sandbox-root` — red at module load, same cause, three packages

```
Error: Cannot find module '@deepseek-ai/dsh-sandbox-policy'
    at file:///…/tests/world-factory/a5sf-pd14-sandbox-root.test.mjs:102:71
  code: 'MODULE_NOT_FOUND'
✖ tests/world-factory/a5sf-pd14-sandbox-root.test.mjs   ℹ tests 1  ℹ pass 0  ℹ fail 1
```

The file resolves **three** names at module load —

* `@deepseek-ai/dsh-sandbox-policy` (`:102`),
* `@deepseek-ai/dsh-sandbox-local` (`:103`),
* and (in 4.1) `@deepseek-ai/dsh-persona` —

from `packages/runtime`, and **none of the three is declared in `packages/runtime/package.json` or in the root manifest**. With `NODE_PATH` injected and the host absent it is `12 tests / 9 pass / 3 declared skips` (the audit's "9/12 arms"), i.e. the suite is fine — the resolution path is not.

**Correct repair site:** `packages/runtime/package.json` **`devDependencies` on all three** (`dsh-persona`, `dsh-sandbox-policy`, `dsh-sandbox-local`). It is *not* a root-manifest fix: the root manifest is not a resolution site for a `require` that originates in `packages/runtime`. It is not a `NODE_PATH` fix either — that only works on a hand-linked tree, which is what made the audit's measurement wrong. A manifest + lockfile change belongs in its own reviewed PR (the B5 "fix test then collect" class), not in a collection change.

### 4.3 `a5sf-debt-register` — a stale anchor, moved by a later merge

```
✖ (b) every anchor resolves and still contains the symbol the row claims (5.36134ms)
  AssertionError [ERR_ASSERTION]: PD-14: anchor tests/world-factory/lib/world-factory.mjs#L604-604
  no longer contains "#teamWorkspaceRows(rows)" — the register describes a line that moved or changed
ℹ tests 10   ℹ pass 9   ℹ fail 1
```

`#teamWorkspaceRows` is at `tests/world-factory/lib/world-factory.mjs:614` on this base; `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md:697` still pins `:604`. `git log` on the lib shows the move came from **#779** (`b0f5eb4e3`), merged after the audit's base — so the audit's "10/10 green" was true on the tree it measured. The fix edits a file under `docs/plans/active/`, which this worker must not touch (§ ownership), so the row stays uncollected and is reported here.

## 5. The collection change (exact shape)

The 28 are `node:test` suites, so no `vitest` `include[]` can reach them and the L2 census population cannot carry them: the census derives its roots from the **root `vitest.config.ts`** and runs `vitest run`. The existing collector for this family is the manifest's node:test dispatch (`dev/ci/eb3-ci-manifest.json` `suites[]` → `scripts/dispatch-tests.mjs`), which is the M6 authority both the catalog and the dispatcher read. So the collection is one thing:

- **28 paths appended to the existing `tinf-instruments` leg's `suites[]`** (after B2's nine), plus that leg's `env` declaring `A5SF_REQUIRE_PINNED_HOST=1`;
- **no new leg, no new step, no new workflow, no new job, no new Required context** — `EB3-CI-REQUIRED pass workflows=10` and `dispatch-tests --check PASS legs=18` both before and after (the leg count is 18, not 19: revision 1's extra leg is gone);
- the step that already ran the leg gains a step-level `env: A5SF_REQUIRE_PINNED_HOST: '1'`, and its ratchet moves 75 → 47.

Why this leg: it is the manifest's **test-instrument** leg, and M7-A's two real-host-slice instruments plus B2's nine authority laws already ride it for exactly this reason. A new leg was measured against the pinned base and produced `problems=1` (§0.1).

**Disclosed consequence, now zero.** `--parity` against the pinned base is `problems=0` (§0.1), and `scripts/test-catalog.test.mjs` — which pins that evidence — is green (§9). Revision 1 raised `problems` from 18 to 19 and presented it as acceptable; it was not.

**Exact leg / argv.** Declared invocation (`dev/ci/eb3-ci-manifest.json`):

```
node scripts/dispatch-tests.mjs --run --leg tinf-instruments
```

Real execution, **with the host absent and the leg's own env**, by the leg itself:

```
$ unshare -m -r sh -c 'mount --bind <empty> …/dsh-agent-team/tests
    export A5SF_REQUIRE_PINNED_HOST=1 A5SF_PD31_HOST_TREE=/nonexistent
    node scripts/dispatch-tests.mjs --run --leg tinf-instruments'
ℹ tests 782
ℹ pass 776
ℹ fail 0
ℹ skipped 6
ℹ duration_ms 215577.226035
DSH-TEST-DISPATCH mode=run leg=tinf-instruments suites=49 files=49 exit=0 set=sha256:ccb1ac26456671a1da9fbf5b61f17f6a271ef14d121d76123d9bf054147dd9e7
```

49 = 21 pre-existing (M1/M3/M4 instruments, four trust-closeout controls, M7-A's 2, B2's 9) + the 28 B3 files. 782 arms = the leg's existing arms + 426.

## 6. Host-absent negative controls (mandatory) — verbatim

### 6.1 A host-dependent file fails, it does not skip

Same `unshare` invocation as §2, same env, host-dependent files from the deferred B4 set:

```
===== HIDDEN+REQUIRE a5sf-pd17-fs-read-axis      rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
===== HIDDEN+REQUIRE a5sf-pd15-face-bound-proof  rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use/packages/web/web/lib/index.js' imported from …/tests/world-factory/lib/a5sf-web-arms.mjs
===== HIDDEN+REQUIRE a5sf-pd19-fact-attribution   rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
===== HIDDEN+REQUIRE a5sf-pty-contract            rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
Error: A5SF-PTY-CONTRACT-HOST-INCOMPLETE: … a partial or older host is a pin violation (expected 639ed015… / 0.2.0-rc.2, built)
```

### 6.2 The trap, and the flag that closes it (the review's HIGH item)

With the tree **genuinely absent** (parent `tests/` bound empty) and **no** flag, the same suite exits 0 while running nothing:

```
$ unshare -m -r sh -c 'mount --bind <empty> …/dsh-agent-team/tests …'
TREE-GENUINELY-ABSENT
=== WITHOUT the flag (the trap)
rc=0
A5SF-PTY-CONTRACT-HOST-REFUSED schema=a5sf-host-refusal/1 refused=1 skipped=15 cases=15 verdict=NOT_RUN
  pinned=639ed015… baseline=0.2.0-rc.2 reason=pinned-host-not-provisioned
﹣ P1-ONE-ALLOCATE-PER-SESSION … — REFUSED (pinned host not provisioned)
  (…all 15 arms carry ﹣ REFUSED…)
ℹ tests 15   ℹ pass 0   ℹ fail 0   ℹ skipped 15
```

With the flag the leg now declares and sets — the same command, the same absent tree:

```
=== WITH the leg env A5SF_REQUIRE_PINNED_HOST=1
rc=1
Error: A5SF-PTY-CONTRACT-HOST-INCOMPLETE: A5SF_REQUIRE_PINNED_HOST=1 but the pinned host is absent at
  …/.worktrees/b3-collect-20261116/tests/deepseek-harness-test-use — provision tests/deepseek-harness-test-use
  at 639ed015397290b3745d163aafe02ffee4aa3f84 (0.2.0-rc.2) and build it, or unset A5SF_REQUIRE_PINNED_HOST
  to accept the declared refusal
ℹ tests 1   ℹ pass 0   ℹ fail 1   ℹ skipped 0
```

That pair is the whole point: `rc=0 verdict=NOT_RUN` becomes `rc=1 fail 1 skipped 0`. The flag is not prose — `CI_LAYER_LEG_ENV_MISSING` proves the step carries what the manifest declares, and `CI_HOST_REFUSAL_UNGUARDED` refuses any other `hostFree` leg that lists a refusal-capable suite without either the flag or the named exception (§0.3). Both are negative-controlled (`28/28 control(s) behaved as required`).

**The collected set's half of the control:** the 28 are green with the host absent *and* present, and the whole leg is green with the flag on (§5). Because none of the 28 names `A5SF_REQUIRE_PINNED_HOST`, the flag cannot change their verdict — measured: the leg's token is identical with and without the host, and the 6 skips are identical too.

## 7. Red negative control — the collection can fail

One assertion in a newly collected file was temporarily mutated to the wrong precedence, and the **real leg** was run (host absent):

```diff
-  assert.equal(matchLocator(lane({ deny: ['/w/secret'], ask: ['/w/secret'] }), '/w/secret/x'), 'deny')
+  assert.equal(matchLocator(lane({ deny: ['/w/secret'], ask: ['/w/secret'] }), '/w/secret/x'), 'ask') // NEGATIVE CONTROL (temporary): wrong expected precedence
```

Red, in the leg that now collects the file:

```
✖ ASK-P1 an explicit deny subtree wins over an ask rule covering the same locator (1.519417ms)
ℹ tests 782
ℹ pass 776
ℹ fail 1
ℹ skipped 6
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

'deny' !== 'ask'

    at TestContext.<anonymous> (file:///…/tests/world-factory/a5sf-ask-precedence.test.mjs:24:10)
  actual: 'deny',
  expected: 'ask',
DSH-TEST-DISPATCH mode=run leg=tinf-instruments suites=49 files=49 exit=1 set=sha256:ccb1ac26…dd9e7
```

The mutation was reverted (`git checkout -- tests/world-factory/a5sf-ask-precedence.test.mjs`; `git status --porcelain tests/world-factory/` is empty) and the same leg is green again (`ℹ tests 782 / ℹ pass 776 / ℹ fail 0 / ℹ skipped 6`, `exit=0`, same `set=`). The red is for the right reason: `ASK-P1` is the arm that pins deny-over-ask, the only observable shape in which a reordered matcher silently turns a refusal into a prompt.

## 8. Ratchet and population

- `dev/ci/uncollected-baseline.json` **regenerated**, not hand-edited:
  `node scripts/test-catalog.mjs --write-uncollected-baseline` → `DSH-UNCOLLECTED-BASELINE written=ok uncollected=47`, **exactly 47 entries**, `uncollected_count: 47`. The diff is 28 row deletions + the count line (1 insertion / 169 deletions), and the removed set was diffed against the leg's `suites[]`: **equal** (28 = 28, `removed-but-not-in-leg []`).
- `.github/workflows/ci-integration.yml` `--max-uncollected 75` → **`--max-uncollected 47`**. Tightened, not loosened; the check itself is untouched.
- **Census population: unchanged, and verified unchanged.** These are `node:test` suites; the census derives its roots from the root `vitest.config.ts` and runs `vitest run`, so nothing enters or leaves the vitest population. Population baseline stays **12 roots / 712 files** (`dev/ci/census-population-baseline.json`, `accepted_reason` still the B1 row — no regeneration is honest here, because nothing changed), and the catalog digest is identical before and after (`sha256:5f71c543…18b6`, computed from id/path/runner/kind/contracts, not from classification). Consequently the pins in `scripts/census-plan.test.mjs` (50/50) and `scripts/census-cutover.test.mjs` (41/41) needed **no** edit and were re-run green as-is. `node scripts/census-plan.mjs --plan` still derives 24 tasks.

Before / after (same command, this branch's base vs. head):

```
$ node scripts/test-catalog.mjs --max-uncollected 75      # base: master + B2
  DISCOVERED_AND_COLLECTED 783
  UNCOLLECTED              75

$ node scripts/test-catalog.mjs --max-uncollected 47      # this branch
  DISCOVERED_AND_COLLECTED 811
  UNCOLLECTED              47
DSH-TEST-CATALOG tests=872 digest=sha256:5f71c543…18b6 refused=0 findings=0
```

For B3 alone against `origin/master` (`7d1d55259`) the same change is **84 → 56**; the 47 here is B3 on top of B2's 75, which is the honest number for this branch's floor.

## 9. Gates (all run on this branch, in this order)

| gate | command | output | exit |
| --- | --- | --- | :---: |
| catalogue ratchet | `node scripts/test-catalog.mjs --max-uncollected 47` | `DISCOVERED_AND_COLLECTED 811 · UNCOLLECTED 47 · refused=0 findings=0` | 0 |
| **parity evidence pin** | `node --test scripts/test-catalog.test.mjs` | `tests 26 · pass 26 · fail 0` | 0 |
| parity vs pinned base | `node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670` | `DIFFERS steps=18 old_files=25 new_files=68 problems=0` | 1 = `DIFFERS` by design; `problems=0` |
| dispatcher | `node scripts/dispatch-tests.mjs --check` | `PASS legs=18 bad=0` | 0 |
| dispatcher laws | `node --test scripts/dispatch-tests.test.mjs` | `tests 5 · pass 5 · fail 0` | 0 |
| Required shape | `node scripts/eb3-ci-required.mjs` | `EB3-CI-REQUIRED pass workflows=10 findings=0` | 0 |
| layer laws (unit) | `node --test scripts/eb3-ci-required.test.mjs` | `tests 6 · pass 6 · fail 0` | 0 |
| negative controls (layer) | `node scripts/eb3-ci-negative-controls.mjs` | `28/28 control(s) behaved as required` | 0 |
| census pins | `node --test scripts/census-plan.test.mjs` | `tests 50 · pass 50 · fail 0` | 0 |
| census cutover pins | `node --test scripts/census-cutover.test.mjs` | `tests 41 · pass 41 · fail 0` | 0 |
| the leg itself | `node scripts/dispatch-tests.mjs --run --leg tinf-instruments` (host absent, flag on) | `tests 782 · pass 776 · fail 0 · skipped 6` | 0 |
| docs | `node scripts/docs-sync.mjs --check` | `findings=0 blocking=0 contracts=20 pairs compared` | 0 |
| identities | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `76 distinct; new 0, resolved 0` | 0 |
| whitespace | `git diff --check` | (no output) | 0 |

## 10. What stays uncollected, and why B4 is deferred

- **B3 → 3 files stay out** (§4): two install-shape reds and one stale product-debt anchor. Repair first, then collect — same rule the audit applied to B5.
- **B4 (18 host-dependent world-factory suites) is not collected and not touched.** They need the pinned **built** tree and a leg that provisions it; without that the suites report `verdict=NOT_RUN` with 15 skips and exit 0 (§6.2). Their provisioning is a gate change (a new step that clones/installs/builds `639ed01539`, or the published-package transport that landed in `e3e93ea94`), and a gate change gets its own reviewed PR. Measured on this base, the sample fails hard when the host is absent **and the flag is set**: `pd17`, `pd15`, `pd19`, `pty-contract` → `rc=1, fail 1, skipped 0`.
- Everything else (`B2`'s tenth file, `B5` 3 — now including the 3 above, `B6` 3, `B7` 3, `B8` 3, `B9` 13) is untouched. `75 − 28 = 47`.

## 11. Explicitly not done

- No test file was moved, renamed, rewritten, archived or deleted. (One assertion was mutated for §7 and reverted; `git status` is clean for `tests/`.)
- No new workflow, no new job, **no new leg**, no new Required context, no change to `ci-required.yml`/`ci-product.yml`/`census-runtime.yml`.
- No product code, no `packages/**` source, no lockfile, no `vitest.config.ts` change.
- No host-provisioned leg, no B4 collection, no B4 file made to skip.
- Nothing of B2's was modified (its 9 suites, baseline and memo are as authored on `task/b2-collect-20261116`).
- No commit to `master`, no `gh pr ready`, no merge.
