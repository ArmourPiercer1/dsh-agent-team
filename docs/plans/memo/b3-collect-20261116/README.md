# B3 — collect the 28 measured host-free world-factory suites (76 → 48 uncollected)

**Dated:** 2026-11-16 (re-derived after review round 1) · **Branch:** `task/b3-collect-20261116` · **Worktree:** `.worktrees/b3-collect-20261116`
**Base:** `origin/master` @ `81bf61ccf` — B2 landed, at **8 of 9** suites, `84 → 76` (see §0.5)
**Scope:** batch **B3** of `docs/plans/memo/uncollected-audit-20261115/` (PR #777, audit at `4644dbe84`): the world-factory suites the audit classified "host-free green".
**Conclusion first:** of the audit's 31 B3 files, **28 are green with the pinned host tree absent** and are collected by appending them to the **existing** `tinf-instruments` leg's `suites[]` (20 → 48) — no new workflow, no new job, no new leg, no new Required context, no test rewritten. **3 are not collectable as-is** and stay uncollected with their measured red output below. Uncollected goes **76 → 48**; the ratchet is tightened 76 → 48. The leg now **declares and sets `A5SF_REQUIRE_PINNED_HOST=1`**, so an absent host is a red, never a `NOT_RUN`, and `eb3-ci-required` grades both halves so the trap cannot recur silently. Both required negative controls are quoted verbatim.

## 0. Review rounds — what changed, and why

### 0.5 Why this branch was rebased (round 2)

Round 1 was written against `task/b2-collect-20261116` @ `49bb277f3` (B2 draft, 9 suites, `84 → 75`). That branch was **squashed onto master as `81bf61ccf` and landed at 8 of 9 suites, `84 → 76`** — `tests/s2-authority/freeze-candidate.test.mjs` stayed uncollected (its `--check` case passed on one hosted head and failed on another with a byte-identical set), and the ratchet landed at **76** with `tinf-instruments` at **20** suites. So the floor moved and every number in round 1 was stale: the branch now carries a **content-only sync merge whose tree equals `origin/master`**, and B3 is re-derived on top of it. `git diff origin/master HEAD` is exactly the eight B3 files; `git log` keeps the pre-squash B2 commits as graph history only (no commit already on master was rewritten, and nothing was force-pushed).

### 0.1 BLOCK 2 (round 1) — a new leg was a permanent parity problem; reshaped onto `tinf-instruments`

Round 1 introduced `dispatch_id: "a5sf-worldfactory-c1"` as a **new leg** and disclosed `--parity` `problems` 18 → 19 as "a migration report, not a gate". That was wrong twice over: the pinned law compares against **`e5bf05670`** (the last commit whose workflows carry hand-written `node --test` lists), a brand-new dispatch step has no old-side argv there, and `scripts/test-catalog.test.mjs` **pins** the evidence file. Measured on that shape: `problems=1`, `UNCONVERTED step a5sf world-factory C1`. The manifest's own M7-A/B2 rationales forbid exactly this. After the reshape, re-measured on the landed base:

```
$ node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670
DISPATCH-PARITY mode=inspect DIFFERS steps=18 old_files=25 new_files=67 problems=0
  union old=25 new=67 set=sha256:4f8ba2615c9cec27d75c0366d5bd1599d12c044fb6dab19cd3d1a6151e1494ee
```

Every row `missing=none`. `added=` names exactly **42** files — the four trust-closeout controls, M7-A's two, **B2's eight as landed**, and these 28 — which is the number `scripts/test-catalog.test.mjs` now pins. (Round 1's 43 was 4 + 2 + B2's *nine* + 28; the ninth suite did not land. Any arithmetic that starts from "9 + 28" is wrong.)

### 0.2 BLOCK 1 (round 1) — `scripts/test-catalog.test.mjs` is in every gate list

It was red in round 1 (`25/26`) and missing from the gate table, which made the Required `ci-integration` layer red. It is suite #1 of the `tinf-instruments` leg, so it is part of every gate run below.

### 0.3 HIGH (round 1) — the `NOT_RUN` trap is declared, set and graded

`hostFree` does **not** enforce `legs[].suites` (`checkSuiteLists` only grades `layer.suiteList`, and `ci-integration` has none), so a `pty-contract`-class suite in that leg would exit **0** with `verdict=NOT_RUN` while `eb3-ci-required` still said `pass workflows=10 findings=0`. Now:

1. the **manifest leg** declares `"env": {"A5SF_REQUIRE_PINNED_HOST": "1"}`;
2. the **workflow step** sets the same value (`env:` at step level, not an inline assignment — the leg-assignment allowlist is untouched);
3. **two new graded rules** close the recurrence:
   * `CI_LAYER_LEG_ENV_MISSING` — a leg's declared `env` must appear, with the same value, on the step that EXECUTES that leg (the law `cmd`/`check[]` already had);
   * `CI_HOST_REFUSAL_UNGUARDED` — a `hostFree` leg listing a suite that consults `A5SF_REQUIRE_PINNED_HOST` must either set it to `1` or declare the reviewed exception `hostRefusal: 'declared-not-run'`.
4. the **one pre-existing exception** is named rather than silent: `a5sf-fs-contract-layer-b` carries `hostRefusal: 'declared-not-run'` (that lane deliberately provisions no host; its suite reports `A5SF-FS-CONTRACT-HOST-REFUSED` for a declared NOT_RUN).

Both are negative-controlled (`C10b`, `C10c`), `28/28 control(s) behaved as required` — **re-verified on the landed-B2 base**, where B2 had changed the manifest and the ratchet. Neither rule fires on B2's entries; the exception is a declaration, not a weakening.

### 0.4 MED (round 1) — the repair site is `packages/runtime/package.json`, on three packages

`a5sf-pd14-sandbox-root` resolves `@deepseek-ai/dsh-sandbox-policy` (`:102`) and `@deepseek-ai/dsh-sandbox-local` (`:103`); `a5sf-governed-preset` resolves `@deepseek-ai/dsh-persona`. **None of the three is declared in `packages/runtime/package.json` or in the root manifest** — and the root manifest is not a resolution site at all, because the suites `runtimeRequire.resolve(...)` **from `packages/runtime`**. The audit's green came from `NODE_PATH=<repo>/node_modules/.pnpm/node_modules`, which injects pnpm's hoist; no workflow sets it. Correct repair: **`packages/runtime/package.json` `devDependencies` on all three** — a manifest + lockfile change, its own reviewed PR. §4 states this.

## 1. What B3 was, and why it had to be re-measured

The audit's rev-2 header records the reason this batch cannot be taken on trust:

> **Rev 2** after review of PR #777: rev 1's "host-free" claim was **wrong for 18 files**. It said 37 files run host-free in the `a5sf-worldfactory-c1` leg; the measurement in §4 gives **31**, and 18 moved to a host-provisioned leg (§6.1).

The defect was mechanical: these files live under `tests/world-factory/` and resolve the pristine checkout through `tests/paths.mjs#findTestRepoRoot()`, which walks **up** from the worktree. A test worktree at `…/dsh-agent-team/.worktrees/<task>` therefore finds the **main checkout's** `tests/deepseek-harness-test-use` and goes green — in a directory it never names.

## 2. Method (re-runnable)

1. **Clean install, in the CI shape.** A checkout without `node_modules` reds these suites for the *wrong* reason (`Cannot find module '@deepseek-ai/cordis'`. Installed exactly as `ci-integration` does: `pnpm install --offline --frozen-lockfile --store-dir .worktrees/pnpm-store` (pnpm 11.7.0). **No `NODE_PATH`** — this matters; see §4.1.
2. **Host absent, private mount namespace.** The tree `findTestRepoRoot()` actually reaches from this worktree is the main checkout's, so *that* is the path to empty:

   ```sh
   EMPTY=.artifacts/tmp/empty && mkdir -p "$EMPTY"
   unshare -m -r sh -c '
     mount --bind "'"$PWD/$EMPTY"'" /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use
     test -z "$(ls -A /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use)"
     export A5SF_REQUIRE_PINNED_HOST=1 A5SF_PD31_HOST_TREE=/nonexistent
     node scripts/dispatch-tests.mjs --run --leg tinf-instruments
   '
   ```

   `A5SF_REQUIRE_PINNED_HOST=1` turns a declared refusal into a failure; `A5SF_PD31_HOST_TREE=/nonexistent` defeats the main-checkout fallback.
3. **Also measured in a full clone (the hosted-runner shape).** A separate `git clone` of the branch head inside `.artifacts/` (gitignored), with `pnpm install --frozen-lockfile`, is the CI checkout: full history (what `fetch-depth: 0` gives) and **no pinned host anywhere in the clone**. Run twice — once with the ancestor host reachable, once with it bound empty (§6.3). The two runs produced the **same token**.
4. **Collected-anywhere-today** for all 31: `git show` over every `.github/workflows/*`, `dev/ci/eb3-ci-manifest.json`, `scripts/dispatch-tests.mjs`, `dev/ci/test-contracts.json` and `tests/checks/*` → **0 mentions of any of the 31 paths** at base. They were strictly uncollected, not duplicate-collected.

## 3. The 31 B3 files, measured with the host absent

`arms` = `ℹ tests`; `skip` = `ℹ skipped`. All rows `rc=0` unless marked. Every row: **collected anywhere today = no (0 declarations)**.

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
| 23 | `port-probe.test.mjs` | 5 | 5 | 0 | green, host-free (own bound: 3080/3180 asserted out of range) | **yes** |
| 24 | `u6-arc-d.test.mjs` | 8 | 8 | 0 | green, host-free | **yes** |
| 25 | `u7-tbash-offline-drive.test.mjs` | 1 | 1 | 0 | green, host-free | **yes** |
| 26 | `u7-tbash-seam.test.mjs` | 9 | 9 | 0 | green, host-free | **yes** |
| 27 | `u7-tbash.test.mjs` | 8 | 8 | 0 | green, host-free | **yes** |
| 28 | `u7-uileg0-answer-drive.test.mjs` | 10 | 10 | 0 | green, host-free | **yes** |
| 29 | `a5sf-governed-preset.test.mjs` | 17 | 16 | 0 | **RED** — install-shape, not host (§4.1) | no |
| 30 | `a5sf-pd14-sandbox-root.test.mjs` | 1 | 0 | 0 | **RED (module load)** — install-shape, not host (§4.2) | no |
| 31 | `a5sf-debt-register.test.mjs` | 10 | 9 | 0 | **RED** — stale product-debt anchor (§4.3) | no |

**Totals:** 28 collected files = **426 arms, 420 pass, 0 fail, 6 declared skips**. The leg now reports **781 arms / 775 pass / 0 fail / 6 skipped** (master's 20-suite leg contributes 355). The 6 skips are all source-declared "PRE-FIX / PIN / FORK" arms and are identical with the host **present** (verified by re-running `pd26` (4), `pd12` (1), `pd13` (1) host-present: same counts, same titles). They are not host-absence skips, the only kind that would make a green vacuous.

**Three of the 28 read pinned ANCESTOR commits** through `git show` / `git cat-file` — `a5sf-pd26-confined-skill` (`06adbf850`), `a5sf-pd29-goal-stop` (`24d2cf760`), `a5sf-pd34-member-stop`. The leg therefore depends on the job's declared `fetch-depth: 0` checkout (line 68 of `ci-integration.yml`), exactly as B2's ancestors do; a depth-1 checkout would red them for a reason that is not the code. `binding-digests` only reads `git rev-parse HEAD`.

**Split vs the audit:** the audit's B3 said 31 host-free / B4 18 host-dependent. Measured: **28 green host-free, 3 host-independent red** (not B4 either — removing the host changes nothing for them). B4 is untouched (§10).

## 4. The three that are not collectable as-is (measured, not inferred)

All three are red **with or without** the host tree absent.

### 4.1 `a5sf-governed-preset` — red in the CI install shape

```
✖ G0 the shipped preset is declared, opt-in, shell-free, PD-18 closed and resolvable (12.316817ms)
  AssertionError [ERR_ASSERTION]: Got unwanted exception: @deepseek-ai/dsh-persona (persona) must resolve
    actual: Error: Cannot find module '@deepseek-ai/dsh-persona'
```

G0 asserts that every plugin name in the shipped governed preset resolves from `packages/runtime`'s manifest. `@deepseek-ai/dsh-persona` is **not a declared dependency** of `packages/runtime`; pnpm's isolated linker installs it only into `node_modules/.pnpm/node_modules`. Green only when `NODE_PATH` injects that hoist — which is what the audit's hand-linked worktree did (`17 tests / 17 pass`). `ci-integration` sets no `NODE_PATH`.

### 4.2 `a5sf-pd14-sandbox-root` — red at module load, same cause, three packages

```
Error: Cannot find module '@deepseek-ai/dsh-sandbox-policy'
    at file:///…/tests/world-factory/a5sf-pd14-sandbox-root.test.mjs:102:71
  code: 'MODULE_NOT_FOUND'
✖ tests/world-factory/a5sf-pd14-sandbox-root.test.mjs   ℹ tests 1  ℹ pass 0  ℹ fail 1
```

The file resolves **three** names at module load — `@deepseek-ai/dsh-sandbox-policy` (`:102`), `@deepseek-ai/dsh-sandbox-local` (`:103`), and (in 4.1) `@deepseek-ai/dsh-persona` — from `packages/runtime`, and **none of the three is declared in `packages/runtime/package.json` or in the root manifest**. With `NODE_PATH` injected and the host absent: `12 tests / 9 pass / 3 declared skips` (the audit's "9/12 arms").

**Correct repair site:** `packages/runtime/package.json` **`devDependencies` on all three**. Not a root-manifest fix (the root manifest is not a resolution site for a `require` originating in `packages/runtime`), and not a `NODE_PATH` fix (that only works on a hand-linked tree — which is what made the audit's measurement wrong). Manifest + lockfile change ⇒ its own reviewed PR (the B5 "fix test then collect" class).

### 4.3 `a5sf-debt-register` — a stale anchor, moved by a later merge

```
✖ (b) every anchor resolves and still contains the symbol the row claims (5.36134ms)
  AssertionError [ERR_ASSERTION]: PD-14: anchor tests/world-factory/lib/world-factory.mjs#L604-604
  no longer contains "#teamWorkspaceRows(rows)" — the register describes a line that moved or changed
ℹ tests 10   ℹ pass 9   ℹ fail 1
```

`#teamWorkspaceRows` is at `tests/world-factory/lib/world-factory.mjs:614` on this base; `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md:697` still pins `:604`. The move came from **#779** (`b0f5eb4e3`), merged after the audit's base — the audit's "10/10 green" was true on the tree it measured. The fix edits `docs/plans/active/`, which this worker must not touch, so the row stays uncollected and is reported here.

## 5. The collection change (exact shape)

The 28 are `node:test` suites, so no `vitest` `include[]` can reach them and the L2 census cannot carry them (its roots come from the root `vitest.config.ts`). The existing collector for this family is the manifest dispatch (`dev/ci/eb3-ci-manifest.json` `suites[]` → `scripts/dispatch-tests.mjs`) — the M6 authority both the catalog and the dispatcher read. So the change is:

- **28 paths appended to the existing `tinf-instruments` leg's `suites[]`** (after B2's eight as landed), **20 → 48 suites**, plus that leg's `env` declaring `A5SF_REQUIRE_PINNED_HOST=1`;
- **no new leg, no new step, no new workflow, no new job, no new Required context**: `EB3-CI-REQUIRED pass workflows=10 findings=0` and `dispatch-tests --check PASS legs=18 bad=0` before and after;
- the step that already ran the leg gains a step-level `env:` and its ratchet moves **76 → 48**.

**Exact leg / argv.** Declared: `node scripts/dispatch-tests.mjs --run --leg tinf-instruments`. Real execution in the **CI checkout shape** (full clone, CI install, 48 suites):

```
$ git clone <branch> …/.artifacts/b3-ci-clone && pnpm install --offline --frozen-lockfile
$ node scripts/dispatch-tests.mjs --run --leg tinf-instruments
ℹ tests 781
ℹ pass 775
ℹ fail 0
ℹ skipped 6
ℹ duration_ms 56192.040505
DSH-TEST-DISPATCH mode=run leg=tinf-instruments suites=48 files=48 exit=0 set=sha256:9ea399ecadc29135457f6d1f3d1b2bbc58d731f13d0314420c96e2047cb40a5f
```

## 6. Host-absent negative controls (mandatory) — verbatim

### 6.1 A host-dependent file fails, it does not skip

Same `unshare` invocation as §2, host-dependent files from the deferred B4 set:

```
===== HIDDEN+REQUIRE a5sf-pd17-fs-read-axis      rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
===== HIDDEN+REQUIRE a5sf-pd15-face-bound-proof  rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use/packages/web/web/lib/index.js' imported from …/tests/world-factory/lib/a5sf-web-arms.mjs
===== HIDDEN+REQUIRE a5sf-pd19-fact-attribution   rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
===== HIDDEN+REQUIRE a5sf-pty-contract            rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
Error: A5SF-PTY-CONTRACT-HOST-INCOMPLETE: … a partial or older host is a pin violation (expected 639ed015… / 0.2.0-rc.2, built)
```

### 6.2 The trap, and the flag that closes it (the review's HIGH item)

With the tree **genuinely absent** (parent `tests/` bound empty) and **no** flag, the suite exits 0 while running nothing:

```
TREE-GENUINELY-ABSENT
=== WITHOUT the flag (the trap)
rc=0
A5SF-PTY-CONTRACT-HOST-REFUSED schema=a5sf-host-refusal/1 refused=1 skipped=15 cases=15 verdict=NOT_RUN
  pinned=639ed015… baseline=0.2.0-rc.2 reason=pinned-host-not-provisioned
﹣ P1-ONE-ALLOCATE-PER-SESSION … — REFUSED (pinned host not provisioned)   (…all 15 arms)
ℹ tests 15   ℹ pass 0   ℹ fail 0   ℹ skipped 15
```

With the flag the leg now declares and sets — same command, same absent tree:

```
=== WITH the leg env A5SF_REQUIRE_PINNED_HOST=1
rc=1
Error: A5SF-PTY-CONTRACT-HOST-INCOMPLETE: A5SF_REQUIRE_PINNED_HOST=1 but the pinned host is absent at
  …/tests/deepseek-harness-test-use — provision tests/deepseek-harness-test-use at
  639ed015397290b3745d163aafe02ffee4aa3f84 (0.2.0-rc.2) and build it, or unset A5SF_REQUIRE_PINNED_HOST
  to accept the declared refusal
ℹ tests 1   ℹ pass 0   ℹ fail 1   ℹ skipped 0
```

`rc=0 verdict=NOT_RUN` becomes `rc=1 fail 1 skipped 0`. The flag is not prose: `CI_LAYER_LEG_ENV_MISSING` proves the step carries what the manifest declares, and `CI_HOST_REFUSAL_UNGUARDED` refuses any other `hostFree` leg that lists a refusal-capable suite without either the flag or the named exception (§0.3).

### 6.3 The collected set's half — the leg is host-independent, measured twice in a clone

Same clone, same install, same argv; only the pinned host's reachability differs:

```
=== 3. host reachable through the ancestor walk
ℹ tests 781  ℹ pass 775  ℹ fail 0  ℹ skipped 6  ℹ duration_ms 56192.040505
DSH-TEST-DISPATCH … suites=48 exit=0 set=sha256:9ea399ec…40a5f

=== 4. host tree ABSENT (ancestor dir bound empty) + A5SF_REQUIRE_PINNED_HOST=1
ℹ tests 781  ℹ pass 775  ℹ fail 0  ℹ skipped 6  ℹ duration_ms 56295.1432
DSH-TEST-DISPATCH … suites=48 exit=0 set=sha256:9ea399ec…40a5f
```

Identical counts, identical `set=`, no skip appearing or disappearing. None of the 28 names `A5SF_REQUIRE_PINNED_HOST`, so the flag cannot change their verdict — which is the property that makes collecting them safe in a lane that never provisions a host.

## 7. Red negative control — the collection can fail

One assertion in a newly collected file was temporarily mutated to the wrong precedence, and the **real leg** was run (host absent):

```diff
-  assert.equal(matchLocator(lane({ deny: ['/w/secret'], ask: ['/w/secret'] }), '/w/secret/x'), 'deny')
+  assert.equal(matchLocator(lane({ deny: ['/w/secret'], ask: ['/w/secret'] }), '/w/secret/x'), 'ask') // NEGATIVE CONTROL (temporary): wrong expected precedence
```

Red, in the leg that collects the file:

```
✖ ASK-P1 an explicit deny subtree wins over an ask rule covering the same locator (1.519417ms)
ℹ tests 426
ℹ pass 419
ℹ fail 1
ℹ skipped 6
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

'deny' !== 'ask'

    at TestContext.<anonymous> (file:///…/tests/world-factory/a5sf-ask-precedence.test.mjs:24:10)
  actual: 'deny',
  expected: 'ask',
DSH-TEST-DISPATCH mode=run leg=a5sf-worldfactory-c1 suites=28 files=28 exit=1 set=sha256:ea6c7bbd…541f72
```

That run was made on round 1's shape (its own 28-suite leg, same 426 arms); the file and the assertion are unchanged, and the reshaped leg contains the same suite, so the red fires in the merged invocation too. The mutation was reverted (`git checkout -- tests/world-factory/a5sf-ask-precedence.test.mjs`; `git status --porcelain tests/world-factory/` is empty) and the file is green in every run in §5/§6.3. `ASK-P1` is the arm that pins deny-over-ask — the only observable shape in which a reordered matcher silently turns a refusal into a prompt.

## 8. Ratchet and population

- `dev/ci/uncollected-baseline.json` **regenerated**, not hand-edited: `node scripts/test-catalog.mjs --write-uncollected-baseline` → `written=ok uncollected=48`, **exactly 48 entries**. The diff is 28 row deletions + the count line; the removed set was diffed against the leg's added suites: **equal** (28 = 28).
- `--max-uncollected` **76 → 48**. Tightened, not loosened.
- **Census population unchanged, and verified unchanged.** These are `node:test` suites; the census derives its roots from the root `vitest.config.ts` and runs `vitest run`. Population baseline stays **12 roots / 712 files** (no regeneration is honest here — nothing changed), and the catalog digest is identical before and after (`sha256:5f71c543…18b6`; it is computed from id/path/runner/kind/contracts, not classification). The pins in `scripts/census-plan.test.mjs` (50/50) and `scripts/census-cutover.test.mjs` (41/41) needed **no** edit and were re-run green.

Before / after (same command, same tree, `--max-uncollected` at each side's own ratchet):

```
$ node scripts/test-catalog.mjs --max-uncollected 76      # master 81bf61ccf
  DISCOVERED_AND_COLLECTED 782
  UNCOLLECTED              76
DSH-TEST-CATALOG tests=872 digest=sha256:5f71c543…18b6 refused=0 findings=0

$ node scripts/test-catalog.mjs --max-uncollected 48      # this branch
  DISCOVERED_AND_COLLECTED 810
  UNCOLLECTED              48
DSH-TEST-CATALOG tests=872 digest=sha256:5f71c543…18b6 refused=0 findings=0
```

The whole B1 → B2 → B3 ladder on this line: **91 → 84 → 76 → 48** uncollected, every step measured by the tool that grades it.

## 9. Gates (all run on the re-derived head, in this order)

| gate | command | output | exit |
| --- | --- | --- | :---: |
| catalogue ratchet | `node scripts/test-catalog.mjs --max-uncollected 48` | `DISCOVERED_AND_COLLECTED 810 · UNCOLLECTED 48 · refused=0 findings=0` | 0 |
| **parity evidence pin** | `node --test scripts/test-catalog.test.mjs` | `tests 26 · pass 26 · fail 0` | 0 |
| parity vs pinned base | `node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670` | `DIFFERS steps=18 old_files=25 new_files=67 problems=0` | 1 = `DIFFERS` by design; `problems=0` |
| dispatcher | `node scripts/dispatch-tests.mjs --check` | `PASS legs=18 bad=0` | 0 |
| dispatcher laws | `node --test scripts/dispatch-tests.test.mjs` | `tests 5 · pass 5 · fail 0` | 0 |
| Required shape | `node scripts/eb3-ci-required.mjs` | `EB3-CI-REQUIRED pass workflows=10 findings=0` | 0 |
| layer laws (unit) | `node --test scripts/eb3-ci-required.test.mjs` | `tests 6 · pass 6 · fail 0` | 0 |
| negative controls (layer) | `node scripts/eb3-ci-negative-controls.mjs` | `28/28 control(s) behaved as required` | 0 |
| census pins | `node --test scripts/census-plan.test.mjs` | `tests 50 · pass 50 · fail 0` | 0 |
| census cutover pins | `node --test scripts/census-cutover.test.mjs` | `tests 41 · pass 41 · fail 0` | 0 |
| the leg, CI checkout shape | clone + `pnpm install --frozen-lockfile` + `dispatch-tests --run --leg tinf-instruments` | `tests 781 · pass 775 · fail 0 · skipped 6 · 56.2 s` | 0 |
| the leg, host absent | same clone, ancestor host dir bound empty, flag on | `tests 781 · pass 775 · fail 0 · skipped 6` · same `set=` | 0 |
| docs | `node scripts/docs-sync.mjs --check` | `findings=0 blocking=0 contracts=20 pairs compared` | 0 |
| identities | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `76 distinct; new 0, resolved 0` | 0 |
| whitespace | `git diff --check` | (no output) | 0 |

## 10. What stays uncollected, and why B4 is deferred

- **B3 → 3 files stay out** (§4): two install-shape reds and one stale product-debt anchor. Repair first, then collect — the rule the audit applied to B5.
- **B4 (18 host-dependent world-factory suites) is not collected and not touched.** They need the pinned **built** tree and a leg that provisions it; without that they report `verdict=NOT_RUN` with 15 skips and exit 0 (§6.2), which is why the leg now sets the flag. Provisioning is a gate change (clone/install/build `639ed01539`, or the published-package transport from `e3e93ea94`), and a gate change gets its own reviewed PR. Measured on this base, the sample fails hard with the host absent **and the flag set**: `pd17`, `pd15`, `pd19`, `pty-contract` → `rc=1, fail 1, skipped 0`.
- Everything else (`B2`'s two deferred authority files, `B5` 3 — now including the 3 above, `B6` 3, `B7` 3, `B8` 3, `B9` 13) is untouched. `76 − 28 = 48`.

## 11. Explicitly not done

- No test file was moved, renamed, rewritten, archived or deleted. (One assertion was mutated for §7 and reverted; `git status` is clean for `tests/`.)
- No new workflow, no new job, **no new leg**, no new Required context, no change to `ci-required.yml`/`ci-product.yml`/`census-runtime.yml`.
- No product code, no `packages/**` source, no lockfile, no `vitest.config.ts` change.
- No host-provisioned leg, no B4 collection, no B4 file made to skip.
- No commit already on `master` was rewritten; no force-push; no `gh pr ready`; no merge.
