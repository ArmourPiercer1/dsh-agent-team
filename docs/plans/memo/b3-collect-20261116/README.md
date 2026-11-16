# B3 — collect the 28 measured host-free world-factory suites (84 → 56 uncollected)

**Dated:** 2026-11-16 · **Base:** `origin/master` @ `7d1d55259` (B1 merged, PR #780) · **Branch:** `task/b3-collect-20261116` · **Worktree:** `.worktrees/b3-collect-20261116`
**Scope:** batch **B3** of `docs/plans/memo/uncollected-audit-20261115/` (PR #777, audit merged at `4644dbe84`): the world-factory suites the audit classified "host-free green".
**Conclusion first:** of the audit's 31 B3 files, **28 are green with the pinned host tree hidden** and are collected by one new declared leg (`a5sf-worldfactory-c1`) inside the **existing** `ci-integration` layer — one workflow step, no new job, no new Required context, no test rewritten. **3 are not collectable as-is** and stay uncollected with their measured red output below (two are red in the CI *install* shape, one is a stale product-debt anchor). Uncollected goes **84 → 56**; the ratchet is tightened 84 → 56. Both negative controls are quoted verbatim.

## 1. What B3 was, and why it had to be re-measured

The audit's rev-2 header records the reason this batch cannot be taken on trust:

> **Rev 2** after review of PR #777: rev 1's "host-free" claim was **wrong for 18 files**. It said 37 files run host-free in the `a5sf-worldfactory-c1` leg; the measurement in §4 gives **31**, and 18 moved to a host-provisioned leg (§6.1).

The defect was mechanical, not editorial: these files live under `tests/world-factory/` and resolve the pristine checkout through `tests/paths.mjs#findTestRepoRoot()`, which walks **up** from the worktree. A test worktree at `…/dsh-agent-team/.worktrees/<task>` therefore finds the **main checkout's** `tests/deepseek-harness-test-use` and goes green — in a directory it never names. "Green here" was reading the developer's machine.

So this PR starts from the audit's B3 list and re-derives it by measurement: each of the 31 files is run with that tree **hidden**, in the condition a hosted runner actually has.

## 2. Method (re-runnable)

1. **Clean install, in the CI shape.** The worktree had no `node_modules`, and a checkout without one reds these suites for the *wrong* reason (`Cannot find module '@deepseek-ai/cordis'` — an environment fact, not a host fact). Installed exactly as `ci-integration` does:
   `pnpm install --offline --frozen-lockfile --store-dir .worktrees/pnpm-store` (pnpm 11.7.0, the version the workflow pins). **No `NODE_PATH`** — this matters; see §4.1.
2. **Hidden host, private mount namespace.** The tree that `findTestRepoRoot()` actually reaches from this worktree is the main checkout's, so *that* is the path to hide:

   ```sh
   EMPTY=.artifacts/tmp/empty && mkdir -p "$EMPTY"
   unshare -m -r sh -c '
     mount --bind "'"$PWD/$EMPTY"'" /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use
     export A5SF_REQUIRE_PINNED_HOST=1 A5SF_PD31_HOST_TREE=/nonexistent
     node --test <file>
   '
   ```

   The empty bind mount also defeats `A5SF_PD31_HOST_TREE`'s main-checkout fallback, and `A5SF_REQUIRE_PINNED_HOST=1` turns *declared* refusals into failures so a suite cannot turn red into "skipped". (§6 shows the trap this closes, measured.)
3. **Collected-anywhere-today** for all 31: `git show HEAD:` over every `.github/workflows/*`, `dev/ci/eb3-ci-manifest.json`, `scripts/dispatch-tests.mjs`, `dev/ci/test-contracts.json` and `tests/checks/*` → **0 mentions of any of the 31 paths**. They were strictly uncollected, not duplicate-collected.
4. Full sweep rows are reproduced in §3. Every "green" below is an exit code plus a `ℹ pass/fail/skipped` line, not an inference.

Measured environment note: the sweep was re-run from scratch after the install, because the first pass (no `node_modules`) produced nine *load* failures that look like host failures and are not. The first-pass logs are kept under `.artifacts/b3-sweep/` but no verdict in this memo is taken from them.

## 3. The 31 B3 files, measured with the host hidden

`arms` = `ℹ tests`; `skip` = `ℹ skipped`. All rows: `rc=0` unless marked. Every row: **collected anywhere today = no (0 declarations)**.

| # | file (`tests/world-factory/…`) | arms | pass | skip | host-hidden verdict | collected |
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

**Totals:** 28 collected files = **426 arms, 420 pass, 0 fail, 6 declared skips, ~11.6 s serial** (the real leg runs them concurrently in **6.5 s**, §5). The 6 skips are all source-declared "PRE-FIX / PIN / FORK" arms and are identical with the host **visible** — verified by re-running `pd26` (4), `pd12` (1) and `pd13` (1) host-visible: same counts, same titles. They are not host-absence skips, which is the only kind that would make a green vacuous.

**Split vs the audit:** the audit's B3 said 31 host-free / B4 18 host-dependent. Measured: **28 green host-free, 3 host-independent red** (they are *not* B4 either — hiding the host changes nothing for them). The 18-file B4 host-dependent set was confirmed by the same method on a sample (§6) and is untouched here.

## 4. The three that are not collectable as-is (measured, not inferred)

All three are red **with or without** the host tree hidden — i.e. host hiding is not the cause.

### 4.1 `a5sf-governed-preset` — red in the CI install shape

```
✖ G0 the shipped preset is declared, opt-in, shell-free, PD-18 closed and resolvable (12.316817ms)
  AssertionError [ERR_ASSERTION]: Got unwanted exception: @deepseek-ai/dsh-persona (persona) must resolve
    actual: Error: Cannot find module '@deepseek-ai/dsh-persona'
```

G0 asserts that every plugin name in the shipped governed preset resolves from `packages/runtime`'s manifest. `@deepseek-ai/dsh-persona` is **not a declared dependency** of `packages/runtime`; pnpm's isolated linker installs it only into `node_modules/.pnpm/node_modules`. It resolves only if `NODE_PATH` injects that hoist — which is exactly what the audit's hand-linked worktree did:

```
# same file, host hidden, with NODE_PATH=<root>/node_modules/.pnpm/node_modules
ℹ tests 17   ℹ pass 17   ℹ fail 0   ℹ skipped 0
```

`ci-integration` sets no `NODE_PATH`, so under the real install this is red. Collecting it would red the layer.

### 4.2 `a5sf-pd14-sandbox-root` — red at module load, same cause

```
Error: Cannot find module '@deepseek-ai/dsh-sandbox-policy'
    at file:///…/tests/world-factory/a5sf-pd14-sandbox-root.test.mjs:102:71
  code: 'MODULE_NOT_FOUND'
✖ tests/world-factory/a5sf-pd14-sandbox-root.test.mjs   ℹ tests 1  ℹ pass 0  ℹ fail 1
```

`runtimeRequire.resolve('@deepseek-ai/dsh-sandbox-policy')` at module load; the package is not a `packages/runtime` dependency. With `NODE_PATH` injected and the host hidden it is `12 tests / 9 pass / 3 declared skips` (the audit's "9/12 arms"), i.e. the suite is fine — the resolution path is not.

Both 4.1 and 4.2 are **repair-shaped**: either declare the two packages where the suites resolve them from, or resolve them from the root manifest. Either is a product-manifest/lockfile change and belongs in its own reviewed PR (B5's "fix test then collect" class), not in a collection change.

### 4.3 `a5sf-debt-register` — a stale anchor, moved by a later merge

```
✖ (b) every anchor resolves and still contains the symbol the row claims (5.36134ms)
  AssertionError [ERR_ASSERTION]: PD-14: anchor tests/world-factory/lib/world-factory.mjs#L604-604
  no longer contains "#teamWorkspaceRows(rows)" — the register describes a line that moved or changed
ℹ tests 10   ℹ pass 9   ℹ fail 1
```

`#teamWorkspaceRows` is at `tests/world-factory/lib/world-factory.mjs:614` on this base; `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md:697` still pins `:604`. `git log` on the lib shows the move came from **#779** (`b0f5eb4e3`), merged after the audit's base — so the audit's "10/10 green" was true on the tree it measured. The fix edits a file under `docs/plans/active/`, which this worker must not touch (§ ownership), so the row stays uncollected and is reported here.

## 5. The collection change (exact shape)

The 28 are `node:test` suites, so no `vitest` `include[]` can reach them and the L2 census population cannot carry them: the census derives its roots from the **root `vitest.config.ts`** and runs `vitest run`. The existing collector for this family is the manifest's node:test dispatch (`dev/ci/eb3-ci-manifest.json` `suites[]` → `scripts/dispatch-tests.mjs`), which is the M6 authority both the catalog and the dispatcher read. So the collection is:

1. **one new leg inside the existing `ci-integration` layer** — `dispatch_id: "a5sf-worldfactory-c1"`, `suites[]` = the 28 measured paths, `hostFree: true` layer (unchanged);
2. **one new step in the existing `ci-integration` job** — `run: node scripts/dispatch-tests.mjs --run --leg a5sf-worldfactory-c1`;
3. **no new workflow, no new job, no new Required context** (`EB3-CI-REQUIRED pass workflows=10` before and after; the only Required context is still `ci-required`).

A new *leg* rather than an existing one is deliberate: the existing legs are per-surface and their `why` declares their population; folding 28 Alpha.5 world-factory suites into, say, the FS-face or TINF-instrument leg would make those declarations false. It is a step in an existing job, not a job.

**Disclosed consequence.** `scripts/dispatch-tests.mjs --parity` reports new-side-only steps as `UNCONVERTED` (M6's migration proof had an old-side `node --test` argv for every step). This step has no old side **by construction** — nothing ever ran these 28 files. Measured: parity `problems=18` on the base, `problems=19` here (the delta is exactly this step). `--parity` is a migration report, not a gate: no workflow, no `ci-pr-gate` leg and no Required context invokes it. That is the honest cost of collecting a population that was never collected.

**Exact leg / argv.** Declared invocation (`dev/ci/eb3-ci-manifest.json`):

```
node scripts/dispatch-tests.mjs --run --leg a5sf-worldfactory-c1
```

Resolved argv (`node scripts/dispatch-tests.mjs --leg a5sf-worldfactory-c1 --run-args`) is one `node --test` invocation with the 28 paths sorted; the workflow step names only the leg, so step and declaration cannot drift (`CI_LAYER_LEG_MISSING` / `CI_LAYER_LEG_WEAKENED` if they do).

Real execution, **with the host hidden**, by the leg itself:

```
$ unshare -m -r sh -c 'mount --bind <empty> …/tests/deepseek-harness-test-use
    export A5SF_REQUIRE_PINNED_HOST=1 A5SF_PD31_HOST_TREE=/nonexistent
    node scripts/dispatch-tests.mjs --run --leg a5sf-worldfactory-c1'
ℹ tests 426
ℹ pass 420
ℹ fail 0
ℹ skipped 6
ℹ duration_ms 6480.016581
DSH-TEST-DISPATCH mode=run leg=a5sf-worldfactory-c1 suites=28 files=28 exit=0 set=sha256:ea6c7bbd9809136f27368633ceaf88eebad21decfedae6907e11f3e708541f72
```

The identical invocation **with the host visible** produces the identical token (`tests 426 / pass 420 / fail 0 / skipped 6`, same `set=`). The leg's result does not depend on the host tree at all.

## 6. Hidden-host negative control (mandatory) — verbatim

The control has two halves: the collected set must be **green** with the host hidden (§5 above — 426 arms, `fail 0`), and a **host-dependent** file must be **red, not skipped**, under the same condition. Same `unshare` invocation, same env, host-dependent files from the deferred B4 set:

```
===== HIDDEN+REQUIRE a5sf-pd17-fs-read-axis      rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
===== HIDDEN+REQUIRE a5sf-pd15-face-bound-proof  rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use/packages/web/web/lib/index.js' imported from …/tests/world-factory/lib/a5sf-web-arms.mjs
===== HIDDEN+REQUIRE a5sf-pd19-fact-attribution   rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
===== HIDDEN+REQUIRE a5sf-pty-contract            rc=1  ℹ tests 1  ℹ pass 0  ℹ fail 1  ℹ skipped 0
Error: A5SF-PTY-CONTRACT-HOST-INCOMPLETE: the pinned host tree exists at …/tests/deepseek-harness-test-use
but is missing terminalService=…/packages/terminal/terminal/lib/index.js, agentRegistry=…, session=…,
persistentBash=… — a partial or older host is a pin violation (expected 639ed015… / 0.2.0-rc.2, built)
```

**And the trap this proves is closed.** With the tree genuinely **absent** (not merely empty) and no `A5SF_REQUIRE_PINNED_HOST`, the same host-dependent suite exits **0** while running nothing:

```
===== pty-contract, host tree ABSENT, no flag:   rc=0
A5SF-PTY-CONTRACT-HOST-REFUSED schema=a5sf-host-refusal/1 refused=1 skipped=15 cases=15 verdict=NOT_RUN
  pinned=639ed015397290b3745d163aafe02ffee4aa3f84 baseline=0.2.0-rc.2 reason=pinned-host-not-provisioned
ℹ tests 15  ℹ pass 0  ℹ fail 0  ℹ skipped 15
```

That green means "not run". It is why B4 needs a leg that provisions the host **and** sets `A5SF_REQUIRE_PINNED_HOST=1` itself, and why no B4 file is collected here: a collected file that can skip when the host is absent is worse than an uncollected one.

## 7. Red negative control — the collection can fail

One assertion in a newly collected file was temporarily mutated to the wrong precedence, and the **real leg** was run (host hidden):

```diff
-  assert.equal(matchLocator(lane({ deny: ['/w/secret'], ask: ['/w/secret'] }), '/w/secret/x'), 'deny')
+  assert.equal(matchLocator(lane({ deny: ['/w/secret'], ask: ['/w/secret'] }), '/w/secret/x'), 'ask') // NEGATIVE CONTROL (temporary): wrong expected precedence
```

Red, in the leg that now collects the file:

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

The mutation was reverted (`git checkout -- tests/world-factory/a5sf-ask-precedence.test.mjs`; `git status --porcelain tests/world-factory/` is empty) and the same leg is green again:

```
ℹ tests 426   ℹ pass 420   ℹ fail 0   ℹ skipped 6   duration_ms 5060.062948
DSH-TEST-DISPATCH mode=run leg=a5sf-worldfactory-c1 suites=28 files=28 exit=0 set=sha256:ea6c7bbd…541f72
```

The red is for the right reason: `ASK-P1` is the arm that pins deny-over-ask, the only observable shape in which a reordered matcher silently turns a refusal into a prompt.

## 8. Ratchet and population

- `dev/ci/uncollected-baseline.json` **regenerated**, not hand-edited:
  `node scripts/test-catalog.mjs --write-uncollected-baseline` → `DSH-UNCOLLECTED-BASELINE written=ok uncollected=56`, **exactly 56 entries**, `uncollected_count: 56`. The diff is 28 row deletions + the count line (1 insertion / 169 deletions), and the removed set was diffed against the leg's `suites[]`: **equal** (28 = 28).
- `.github/workflows/ci-integration.yml` `--max-uncollected 84` → **`--max-uncollected 56`**. Tightened, not loosened; the check itself is untouched.
- **Census population: unchanged, and verified unchanged.** These are `node:test` suites; the census derives its roots from the root `vitest.config.ts` and runs `vitest run`, so nothing enters or leaves the vitest population. Population baseline stays **12 roots / 712 files** (`dev/ci/census-population-baseline.json`, `accepted_reason` still the B1 row — no regeneration is honest here, because nothing changed), and the catalog digest is identical before and after (`sha256:5f71c543…18b6`, it is computed from id/path/runner/kind/contracts, not from classification). Consequently the pins in `scripts/census-plan.test.mjs` (12/712, 22 → 24 tasks) and `scripts/census-cutover.test.mjs` (24/12/1448/1424) needed **no** edit and were re-run green as-is. `node scripts/census-plan.mjs --plan` still derives 24 tasks.

Before / after (same command, same base):

```
$ node scripts/test-catalog.mjs --max-uncollected 84      # base 7d1d55259
  DISCOVERED_AND_COLLECTED 774
  UNCOLLECTED              84
DSH-TEST-CATALOG tests=872 digest=sha256:5f71c543…18b6 refused=0 findings=0

$ node scripts/test-catalog.mjs --max-uncollected 56      # this branch
  DISCOVERED_AND_COLLECTED 802
  UNCOLLECTED              56
DSH-TEST-CATALOG tests=872 digest=sha256:5f71c543…18b6 refused=0 findings=0
```

## 9. Gates (all run on this branch)

| gate | command | output | exit |
| --- | --- | --- | :---: |
| catalogue ratchet | `node scripts/test-catalog.mjs --max-uncollected 56` | `UNCOLLECTED 56 … refused=0 findings=0` | 0 |
| dispatcher | `node scripts/dispatch-tests.mjs --check` | `DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=19 bad=0` | 0 |
| Required shape | `node scripts/eb3-ci-required.mjs` | `EB3-CI-REQUIRED pass workflows=10 findings=0` | 0 |
| negative controls (layer) | `node scripts/eb3-ci-negative-controls.mjs` | `26/26 control(s) behaved as required` | 0 |
| census pins | `node --test scripts/census-plan.test.mjs` | `tests 50 · pass 50 · fail 0` | 0 |
| census cutover pins | `node --test scripts/census-cutover.test.mjs` | `tests 41 · pass 41 · fail 0` | 0 |
| dispatcher laws | `node --test scripts/dispatch-tests.test.mjs` | `tests 5 · pass 5 · fail 0` | 0 |
| docs | `node scripts/docs-sync.mjs --check` | `findings=0 blocking=0 contracts=20 pairs compared` | 0 |
| identities | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `baseline …: 76 distinct; new 0, resolved 0` | 0 |
| whitespace | `git diff --check` | (no output) | 0 |

**Draft-PR disclosure (same as B1):** `ci-census` is deliberately deferred on drafts, and this leg lives in `ci-integration`, which runs on drafts — so the new step is exercised on the draft PR itself. The collected set is additionally proven locally by the leg's own `--run` with the host hidden (§5).

## 10. What stays uncollected, and why B4 is deferred

- **B3 → 3 files stay out** (§4): two install-shape reds and one stale product-debt anchor. Repair first, then collect — same rule the audit applied to B5.
- **B4 (18 host-dependent world-factory suites) is not collected and not touched.** They need the pinned **built** tree and a leg that provisions it and sets `A5SF_REQUIRE_PINNED_HOST=1`; without that the suites report `verdict=NOT_RUN` with 15 skips and exit 0 (§6). Their provisioning is a gate change (a new step that clones/installs/builds `639ed01539`, or the published-package transport that landed in `e3e93ea94`), and a gate change gets its own reviewed PR. Measured on this base, the sample fails hard with the host hidden: `pd17`, `pd15`, `pd19`, `pty-contract` → `rc=1, fail 1, skipped 0`.
- Everything else (`B2` 10, `B5` 3 — now including the 3 above, `B6` 3, `B7` 3, `B8` 3, `B9` 13) is untouched. `84 − 28 = 56`.

## 11. Explicitly not done

- No test file was moved, renamed, rewritten, archived or deleted. (One assertion was mutated for §7 and reverted; `git status` is clean for `tests/`.)
- No new workflow, no new job, no new Required context, no change to `ci-required.yml`/`ci-product.yml`/`census-runtime.yml`.
- No product code, no `packages/**` source, no lockfile, no `vitest.config.ts` change.
- No host-provisioned leg, no B4 collection, no B4 file made to skip.
- No commit to `master`, no `gh pr ready`, no merge.
