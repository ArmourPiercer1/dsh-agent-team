# A4-PR7 raw gate captures

Unedited stdout of the commands whose numbers are quoted in the lane notes
(`../7-LANE-REPORT.md`, `../7-2-START-ENTRANCE-ENUMERATION.md`,
`../7-3-BLAST-RADIUS-AND-UNEXECUTED-FLIP.md`, `../7-6-ACCEPTANCE-RECEIPTS-PARTIAL.md`).
They live here rather than only in `.scratch/gates/` because `docs/ROUTER_RULES.md`
§1 forbids citing a number that is not durable, and `.scratch/**` is gitignored: a
receipt nobody can read after the session is a claim, not evidence.

Nothing here is curated. Each is the command's own bytes, including its failures.

## Which capture answers which claim

| file | the claim it supports |
| --- | --- |
| `base-run1.txt` | the whole-repo BASELINE failure identity set (9 files / 19 tests at `c7537872`-era base) that every "identity-identical to baseline" statement is diffed against. |
| `7-6-base-c1-repro.txt` | **base passes `c1-list-pending-control` (15/15)** under the identical command with `.tmp-fault` cleared — the half of the blocker record that proves the regression was introduced, not inherited. |
| `7-6-bisect-c1.txt` | the bisect that names `e68d2c74` as the first bad commit. |
| `7-6-head-c1-full.txt` | the real HEAD failure (`authority-scope-required` from `requestApprovalLeg`), i.e. the error the `team_domain already exists` residue was hiding. |
| `7-6-c1-after-fix.txt` | the same file at 15/15 after the fixture carries its `C1_AUTHORITY_SCOPE`. |
| `7-6-c1-siblings.txt` | the systemic sweep: the 10 unswept `operationFingerprint`-without-`authorityScope` candidates plus all of `packages/tools` — 21 passed, 1 failed, that one being `p6t6-actions` from the baseline set. |
| `7-6-full-test.txt` / `7-6-full-test-2.txt` | whole-repo runs before and after the fix; only `-2` is the post-fix acceptance receipt (9 failed files / 19 failed tests, identities = baseline). |
| `7-6-runtime-tools-2.txt` | the `packages/runtime` + `packages/tools` leg (7/9 = baseline subset identity-matched). |
| `7-6-lint-diff*.txt`, `7-6-lint-identities*.txt` | the lint identity diff against `lint-identities-0237d487.txt`: the first run reported `new 2` (both authored by this lane), the re-runs `new 0, resolved 0` at 76 distinct. |
| `7-6-typecheck*.txt` | `pnpm -r run typecheck`: 8/8 `typecheck: Done`, 0 `error TS`. |
| `7-2-*`, `7-1-*`, `7-0-*` | round-1 receipts: the 7.0 RED/production and mutation proofs, the 7.1 mutation proofs, the 7.2 runtime baseline (`7-2-runtime-full.txt`) and post-7.2 parity (`7-2-final-runtime.txt`), plus the p4t6 pin and root runs. |
| `7-3-*` | the flip was NOT executed; these are its measurements — the dry-run typecheck delta (5 `=== 2` errors), the dry-run test fallout, and the blast-radius path sets (`7-3-setA-v12-literal.txt` = every blueprint-shaped v1/v2 literal, `setB-red-refined` = the parser-calling files that go red, `setB2-noparse-refined` = the files that stay green while lying, `setC-envelope-aliases` = the A1-18 alias sites). |
| `7-5-scan-run.txt`, `7-5-offending-paths.txt` | the v3-only fence's own output (exit 1, `RESULT dirty(20 files, 49 sites)`, 114 files in scope) and the offending path set its deferral list enforces in both directions. |
| `run-7-0.sh` | the 7.0 gate driver, kept so the round is reproducible rather than reconstructed. |

## Ruling 1 (`7-r1-*`): migration state as a three-state value on the Remote catalog

One ruling, executed on its own branch at base `4eee9393` and landed as
`73d187bb`: `migrationState: 'current' | 'migration-required' | 'unreadable'`
replaces `migrationRequired: boolean` at every site in one commit, and
`catalog.list` carries it per revision.

| file | the claim it supports |
| --- | --- |
| `7-r1-red-carrier-absent.txt` | **the RED**, run in a pristine sibling checkout of the SAME base commit with no tracked file modified (`git diff --stat` empty in the receipt): 19 tests, **18 failed**, and the one pass is the leg that must pass at base too — the `{ blueprintId, revisions }` preservation pin. It contains the defect in the base build's own words: `expected { …(6) } to not have property "migrationRequired" … Received: false` on a frozen row declaring `schemaVersion: 99`, and `TypeError: Cannot read properties of undefined (reading 'map')` where `revisionStates` should be, observed THROUGH the real root and the real dispatcher. |
| `7-r1-base-fast.txt` | the BASE numbers of the fast set: `pnpm -r run typecheck` 8/8 `Done` / 0 `error TS`, `p4t6` 10 passed (its derived total 1019 at base), `a4pr0a` 14 passed, `lint-identities` 76 distinct with `new 0, resolved 0`, client lane 3 failed / 876 passed. |
| `7-r1-base-full-run1.txt` / `-run2.txt` | the BASE whole-repo runs (486 files; 10 failed files / 23 tests and 10 / 21 — the spread is the declared `p6t1-parallel` flake band), the set `7-r1-identity-diff.txt` diffs against. |
| `7-r1-full-run1.txt` / `-run2.txt` | the POST whole-repo runs on the final tree (487 files — this ruling adds exactly one scannable file; 10 failed files / 20 tests and 9 / 19). |
| `7-r1-identity-diff.txt` (+ `run-7-r1-identity-diff.py`) | counts are not evidence, so this is the identity-set diff: **NEW = 0**; the 5 entries under RESOLVED are `p6t1-parallel` legs that simply did not fire in the post runs, and the base union (28) is wider than either base run for exactly that reason. |
| `7-r1-typecheck-and-fast.txt` | the POST fast set on the final tree: 8/8 `typecheck: Done`, 0 `error TS` tree-wide; `p4t6` 10 passed from the repo root with this PR's own advancing total moved 1019 -> 1020 by the one file it adds; `a4pr0a` 14/14; `lint-identities` 160 lines / 76 distinct, `new 0, resolved 0` — zero mutes; client lane 3 failed / 876 passed, the SAME three names as base. |
| `7-r1-p4t6-total-lag.txt` | an intermediate capture kept, not hidden: the first post run where the new file had been added to `SCANNED_PATHS_A4PR7` but the PR7 delta pin still said `1019 - 1016`, failing `expected 4 to be 3`. Superseded by `7-r1-typecheck-and-fast.txt`. |
| `7-r1-typecheck-red-in-new-test.txt` | the RED test's own first typecheck: 11 `error TS` in the new file (`noUncheckedIndexedAccess` on optional lookups). Fixed by making the wire-shape readers throw with a legible message, not by `!` or a cast. |
| `7-r1-ruling-lane.txt` | the GREEN on the final tree: the ruling's 19 tests plus every consumer of the carrier (the v3-cutover acceptance lane, A1-14 revalidation, bound-Blueprint, the freeze barrier, `bp1-red-probe`, the governance-warning host adapter, the production-entry regression) — 8 files, 131 passed. |
| `7-r1-mutations.txt` (+ `run-7-r1-mutate.py`) | seven mutations, each flipping PRODUCTION ONLY and reverted from the committed tree (the receipt ends with an empty `git status` at `73d187bb`): collapse `unreadable`->`current` (6 red), ->`migration-required` (6 red), unwire the root reader (4 red), drop the payload field (6 red), collapse each arm of the rendered boot line (1 red each), and put the boolean back by hand (1 red — the pin is the TEST, not only `tsc`). |
| `7-r1-artifacts.txt` | `pnpm build` + `build:composition` + `check:artifacts` -> `OK: 1508 files`, with the rebuilt install-surface mirror in the same commit (58 mirror files: 7 this change produces, 51 inherited — see the next row). |
| `7-r1-artifacts-stale-first-run.txt` | the same gate failing (`STALE install-surface artifacts`) on the first run, before the rebuilt mirror was staged — what the gate is for. |
| `7-r1-base-dist-staleness.txt` + `7-r1-base-dist-staleness-exit.txt` | **an inherited finding, not this change's**: rebuilding the UNMODIFIED base source moves 51 committed dist files and `check:artifacts` fails (exit 1, the second receipt is the same gate with no pipe, so its exit line is the gate's own: `[check:artifacts exit=1]`, 51 `content-drift` files, and an empty porcelain outside the two artifact paths). The base commit shipped a mirror that lagged its own source. |
| `run-7-r1-gates.sh` | the gate driver (base and post modes: whole-repo x2 after clearing `.tmp-fault`, then the fast set), kept so the round is reproducible rather than reconstructed. |

## Dated obligation — opened 2026-10-07, trigger: Task 7.3 flips the retired set

**Trigger.** The commit that makes `RETIRED_BLUEPRINT_DOCUMENT_VERSIONS` non-empty
— i.e. 7.3's v3-only cutover, where `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` becomes
`[3]` and v1/v2 become DEFINED-and-retired. That commit, not a later cleanup, owns
this work: the moment the set flips, the proof below stops being the best available
proof and becomes a proof that is no longer needed, and a proof nobody needed is a
proof nobody re-runs.

**The gap being left open, on purpose.** Ruling 1's `migration-required` leg —
identity listing, `catalog.list` payload, and the degraded-boot render — is proven
today against the `cutoverIndex` double that `a4p7-v3-cutover-acceptance.test.ts`
already uses: a source index whose `inspectSource` answers as the inspector of a
build running `[3]`. The authority, live catalog, root, dispatcher and payload are
all the real ones; only the classification input is simulated. That is honest
because at this base **no document on disk can inspect as `migration-required`** —
the bridge still runs v1 and v2, so the retired set is `DEFINED minus SUPPORTED =
∅`, and the emptiness is itself pinned as a law by the acceptance lane's group B.
It is still a double, and a double cannot fail for the reason the real thing would.

**What the flip must replace.** In
`packages/runtime/test/a4p7-v8-catalog-migration-state.test.ts`:

1. group B's `a4p7.catalog.retired@4` and group C's retired-vs-runnable leg — a
   **saved v1 source, unmodified fixture text**, classified by the real
   `inspectBlueprintSource` with `cutoverIndex` deleted from the file entirely;
2. group D's `refusedMigration`, currently a hand-built refused-anchor **value**
   (no anchor reaches that arm yet) — replaced by the result of the real
   `classifyBlueprintAnchor(v1Anchor)`;
3. group A's retired-set leg, whose `expected` is computed from
   `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` alone (`? 'current' : 'unreadable'`)
   because there is no retired version to name yet. It does assert five real
   equalities over `[1, 2, 3, 4, 99]`; what it cannot do is fail for the
   `migration-required` arm, since no version in that list reaches it while the set
   is empty. Its `expected` must become a three-way derivation, and `[1, 2]` must
   then answer `migration-required` for the reason and not by table.

**Done means all three, plus one receipt.** The double is gone (grep the file for
`cutoverIndex`: zero hits), the three legs are RED before that commit's production
flip and GREEN after it in the same commit — the ruling's own discipline, unchanged
— and the raw capture lands here as `7-3-post-flip-migration-state.txt` with its row
in the table above. A flip that leaves this file on the double has not re-proved
anything; it has merely stopped being honest about which part was simulated.

## Supplement S1 (`7-r1-s1-*`): the absent-reader default gets driven, not cited

Independent review returned MERGE-READY and reproduced every load-bearing number,
then named the one claim this file made that nothing executed: the branch answering
`unreadable` when no state was supplied was reached by no test, so flipping it to
`current` left the whole lane green. Two legs added (test-only), both through the
real root and dispatcher.

| file | the claim it supports |
| --- | --- |
| `7-r1-s1-mutations.txt` (+ `run-7-r1-s1.sh`, and `run-7-r1-mutate.py` now carrying M8/M9) | the full nine-mutation sweep on the tree that adds the legs. **M8** flips the default `'unreadable'` -> `'current'`: **2 failed / 77 passed — exactly the two new legs and nothing else**, which is the measurement that the gap existed and is closed. **M9** removes only the closed-set conjunct: **1 failed — only the bogus-state leg**, so the two legs pin different halves of one guard rather than duplicating each other. The other seven keep their meaning; M4's kill set grows 6 -> **8** because the new legs read the same payload field, and that growth is the point of having them. Ends with the S1 test file as the only modified path — no production mutation survived. |
| `7-r1-s1-typecheck-and-fast.txt` | the fast set on the supplemented tree: `pnpm -r run typecheck` 8/8 `Done`, 0 `error TS`; `p4t6` 10 passed (unchanged 1020 — S1 adds legs to an existing file, not a scannable file); `a4pr0a` 14/14; `lint-identities` 160 / 76 distinct, `new 0, resolved 0`; client lane the same three baseline failures. |
| `7-r1-s1-full-run1.txt` / `-run2.txt` | whole-repo ×2 on the supplemented tree: 487 files, **6014 tests** (6012 + the two legs), 9 failed files / 19 failed tests in both runs. |
| `7-r1-s1-identity-diff.txt` | base union (28) against this tree's union (22): **NEW = 0**, the 6 "resolved" being `p6t1-parallel` legs that did not fire in these two runs. |
| `7-r1-s1-ruling-lane-and-artifacts.txt` | the ruling lane at 8 files / **133 passed** (was 131) and `check:artifacts` OK with exit 0 — S1 moved no production line, so the co-committed mirror still matches without a rebuild. |

### Scope of the claim, for the merge body

**`migrationState` is a wire-and-host claim, not a UI claim.** The client's
`parseCatalogList` reads `blueprintId` and `revisions` only, so no interface surface
shows Blueprint migration state today; "migration discoverability" here means an
operator reading `catalog.list` or the degraded-boot line, and it stays that way
until a client lane reads `revisionStates`. The same body should say that the
commit's 58-file install-surface mirror is **51 inherited + 7 authored** — the
staleness is master-side (`b4340c50` and `e68d2c74` shipped source without
rebuilding the mirror), owned there, and merely surfaced here.

## Round 3 (`r3-*`) — the seven fixes on `feat/a4-pr7-r4-fixes`, off `689b716c`

| file | the claim it supports |
| --- | --- |
| `run-r3-gates.sh` | the round-3 gate driver, same shape as `run-7-0.sh`, kept so the round is reproducible. |
| `r3-typecheck.txt` | `pnpm -r run typecheck` at `bbad57aa`: 8 × `Done`, 0 `error TS`. |
| `r3-full-test-run1.txt`, `r3-full-test-run2.txt`, `r3-final-runA.txt`, `r3-final-runB.txt` | four whole-repo runs: 19 / 21 / 19 / 19 failing tests. `r3-run1-failing-identities.txt` and `r3-run2-failing-identities.txt` are the sorted `FAIL` identity sets; their only difference is the two `p6t1-parallel` P1 tests, and the 19-set is identity-identical to `base-run1.txt`. |
| `r3-p6t1-flake-measurement.txt` | the refutation of §8's barrel rule: `p6t1-parallel` alone goes red 2 of 3 runs with no other lane file loaded; the same file is 3-of-3 green *together with* both `a4p7` lanes. |
| `r3-mutation-callsite-drop.txt` | the fix-2 wiring proof: deleting the threaded field **at the call site** (type kept) reddens S1/S2/S4 and leaves all 75 pre-existing tests green. |
| `r3-mutation-required-key-typecheck.txt` | with the key required (`7d047dcb`), the same deletion is a `TS2345` compile error. |
| `r3-mutation-M2-wrong-field.txt` | threading a real-but-wrong durable field (`authorityScope.matcher.resource`) **compiles clean** and reproduces the original fail-open `{"allowed":true}` — the mutant a type-only review cannot catch. |
| `r3-mutation-M1-neuter-meet.txt` | the reviewer's M1 (meet neutered at both sites, set still derived and evaluated) now reddens 7 of this branch's tests in the whole runtime package: 15 failed / 3859 passed, other 8 = baseline. Header records the exact substitution and why `if (false)` was unusable. |
| `r3-p4t6.txt`, `r3-a4pr0a-hygiene.txt`, `r3-client.txt`, `r3-lint-diff.txt`, `r3-lint-identities.txt` | p4t6 pin 10 passed from the repo root; a4pr0a + lane hygiene 35 passed; client lane 3 failed / 876 passed (baseline set, `packages/client` untouched by this branch); lint identities 160 lines / 76 distinct, `new 0, resolved 0`. |
| `r3-build.txt`, `r3-build-composition.txt`, `r3-check-artifacts.txt` | `pnpm build` exit 0; `build:composition` and `check:artifacts` exit 1 on 51 drifted dist files. |
| `r3-dist-drift-at-base.txt` | the drift is inherited: measured at `689b716c` (source exports `operationApprovalCandidatePoints`, committed dist does not contain it), with the 36-inherited / 15-mine split and the last commit to touch that dist file (`a1b2431b`, A4-PR4). |

## Forward-port merge (`7-r1-s2-*`): bringing `#103` onto master without a rewrite

`origin/master` took `#102`/`#105` (its own mirror refresh) and the RULING 4 fixes,
which left `#103` reporting `CONFLICTING`: two branches had each committed a refreshed
mirror of the same inherited drift. Resolved by a forward `git merge` — **no rebase, no
force-push**, because the gated-history rule applies to a merged feature branch and the
merge body cites `8cc6a8bd`, a SHA a rebase would erase.

| file | the claim it supports |
| --- | --- |
| `7-r1-s2-merge-shape.txt` | what the merge actually touched, which is the claim the merge body makes: 33 conflicted paths of which **32 were under `packages/**/dist/`** (taken from `origin/master`, then the merged tree was rebuilt) and **1 was the evidence README** (union, both sections verbatim); the byte-identity of this branch's production files across the merge; and the separation in the one file both branches edited — master's 535 arriving lines contain **zero** mentions of the carrier, while the 30 lines still differing from master are all carrier renames. |
| `7-r1-s2-merge-build-and-artifacts.txt` | `pnpm build` exit 0, `build:composition` exit 0, `check:artifacts` **OK 1508, exit 0**, co-committed into the merge commit — 20 mirror files moved against master's mirror and they are exactly this branch's emissions plus their maps; master's RULING 4 emissions rebuilt byte-identically, which is the sign the two refreshes described the same drift and nothing else. |
| `7-r1-s2-post-merge-gates.txt` (+ `run-7-r1-s2.sh`) | the gates on the merged tree: `pnpm -r run typecheck` 8/8 `Done`, 0 `error TS`; whole-repo `pnpm test` after clearing `.tmp-fault` at **487 files / 6030 tests**, 9 failed files / 19 failed tests; `p4t6` 10 passed from the repo root (its derived total absorbed master's new files without a pin move); `a4pr0a` 14/14; the ruling lane 3 files / 105 passed; `lint-identities` 160 / 76 distinct, `new 0, resolved 0`; client lane the same three baseline failures; `check:artifacts` exit 0. |
| `7-r1-s2-identity-diff.txt` | the base failing-identity union against this merged tree: **NEW = 0**; the 6 "resolved" are `p6t1-parallel` legs that did not fire. |

The mutation sweep was NOT re-run, and the honest reason is recorded rather than
assumed: no production line of this branch changed in the merge — `7-r1-s2-merge-shape.txt`
proves it file by file — and a mutation proof measures a production change that is
still byte-identical to the one already measured.

## Task 7.5 (`7-5-client-closure-scan`, `7-5-mutations`, …): the composition smoke stops lying

Task 7.5 as written in the plan said "`pnpm smoke:composition` fails on the missing `clsx`
dependency" and prescribed adding pins. The ruling executed here is the opposite, and the
plan line stays wrong until the coordinator's records commit (`docs/**` is not this
lane's to edit): **no pin was added, and neither `packages/client/package.json` nor
`pnpm-lock.yaml` is in the diff.** What the round actually changed is the gate.

| file | the claim it supports |
| --- | --- |
| `7-5-client-closure-scan.txt` | the measurement that replaces the plan's diagnosis. `@deepseek-ai/dsh-client-ui-primitives@0.2.0-rc.2` has **no `dependencies` field at all** and one peer (`@deepseek-ai/cordis@~4.0.4`), while its `lib/index.js` statically imports **23** bare packages: **6 resolve** in this workspace and **17 do not**, and the scan the gate itself runs reports `ownUnresolved=0` — every unresolvable specifier is asked for by a third-party file, none by ours. §4 records that `clsx` is only the first of the 17 (pinning it moves the error to `simple-icons`), and §5 is the control that settles the causal story: the host's `lib/index.js` is **byte-identical** (sha256 `6b551f0039ae2632…`, 530719 B) and the identical scan **in the host tree resolves 23/23**. Same bytes, same imports, different install surface. |
| `7-5-registry-probe.txt` | the public-registry half of the same correction, captured while network was available: `0.2.0-rc.2` is published for all four `@deepseek-ai` client packages (`dist-tags.latest` is stale for every one of them — a stale dist-tag is an `npm view` artifact, not a missing version), and `dependencies` is empty for all four at that version. Records too that re-running it needs network plus an in-workspace npm cache. |
| `7-5-smoke-three-state.txt` | `pnpm smoke:composition` verbatim before and after. Before: `FAIL client plugin … Cannot find package 'clsx' …`, exit 1 — a red gate that had been failing for a reason no configuration of this workspace can fix, since the client entry stopped being a skeleton. After: `PASS host plugin` (unchanged, still a real check), `SKIP client plugin (packages/client): host module closure unavailable — 17 unresolvable: <the 17 names>`, nine `PASS client bundle <check-id>` lines, and a summary that says out loud `1 step NOT RUN and NOT passed`. Exit 0. Same file carries the rest of the battery on the final tree: typecheck 8 `Done` / 0 `error TS`, `build` / `build:composition` / `check:artifacts` `OK: 1508 files` with the rebuild **byte-identical** (so no artifact co-commit), eslint exit 0 with zero mutes, `lint-identities` 160 / 76 distinct / `new 0, resolved 0`, client lane 3 failed / 876 passed (the same baseline trio). |
| `7-5-mutations.txt` | **fifteen** mutations, each one an assertion driven red and then reverted (tracked files by `git checkout`, the built entry restored byte-for-byte, the rebuilt bundle re-compared byte-identical). The two the brief asked for by name: **M-c** puts an undeclared import in OUR built entry while the real 17-package gap is present — `FAIL … our own artifact imports specifiers this workspace cannot resolve (no-such-own-dep-75)`, exit 1, i.e. the skip path cannot launder our own bug; **M-m** breaks the entry's syntax with the real gap present (link fails before evaluation, so a module-scope *throw* is unobservable — see M-a2) — `FAIL … a reason that is not a missing upstream package (Unexpected token ':')`, exit 1. Plus **F1**, which makes the closure fake-resolvable and turns the SKIP into `PASS client plugin …`, proving the skip is conditional and the contract checks really run; **M-a3** puts a module-scope throw in the committed BUNDLE — the class the SKIP structurally cannot see — and the offline check turns it red; and one red per offline assertion (row id renamed by one character, `apply` export renamed, plugin name drift, external added, external swapped, shim path typo, shim version drift, composition file removed, placed glue moved). |
| `7-5-p4t6-pin.txt` | this lane's own intermediate red, kept rather than hidden: adding a scannable test file moved `p4t6`'s derived total to `expected 1021 to be 1020`, fixed by the mechanism the file prescribes (name the path in `SCANNED_PATHS_A4PR7`, move the PR7 total), not by touching the total alone. |
| `7-5-post-tightening-reverify.txt` | the command-by-command checklist to re-run after the session is switched to `workspace-write`, with the expected observable for each and what a regression would mean. Nothing in this lane needs network any more: the install is proven `--offline` from the in-workspace store, the registry probe is captured above, and the lane does not push. |
| `7-5-review-round-mutations.txt` | **the review round (2026-10-08), and the read that matters: four of this lane's own claims did not survive an independent review, and this is the receipt for fixing them.** Each of the five findings is reproduced red against the tree at `78153938` before it is fixed — a dangling SUBPATH of an installed package asked for by a NON-ENTRY own file printed the healthy `SKIP … 17 unresolvable …` at md5-identical output and exit 0 (R-1a); an INDENTED own import did the same (R-2b, md5-identical to the clean run); the built shim manifest could advertise an existing file outside both install surfaces while `composition-bundle-is-install-surface` printed its usual PASS (R-3a); a dropped arm printed 8 PASS lines under `PASS composition-smoke` and zero arms printed 0 lines, both exit 0 (R-5a/R-5b); and `resolutionFailureOf` handed the classifier a string containing the offending `package.json` as "the importer", so the zone test was always true and the FAIL came from `package === null` while the message blamed our own artifact over a `node_modules` path. Then the same mutations green (G-1…G-5), then seven mutations of the new code itself (M-A…M-G), each one non-constant-foldable, each landing on the test that pins it. |
| `7-5-review-round-gates.txt` | the full gate list re-run on the final tree, command by command with exit codes: typecheck 8 `Done` / 0 `error TS`, `build`, `build:composition`, `check:artifacts` `OK: 1508 files` with no artifact drift, the named SKIP with the measured 17 names and nine PASS arms at exit 0, the classifier suite 32 (was 21), `p4t6` 10, the client lane's baseline trio 3 failed / 876 passed, the full suite's exact baseline identities 9 failed files / 19 failed tests (total 6062 = the recorded 6051 plus the 11 tests this round added, no new failure), `lint-identities` 160 / 76 / `new 0, resolved 0`, eslint silent at rc 0, and the mute audit showing that the branch's only `eslint-disable` matches are two lines of prose. Its closing section explains how to read three counts that differ from the brief's numbers. |
| `7-5-review-round-raw-captures.txt` | the untrimmed stdout+stderr of every gate-level run behind the two receipts above, sixteen `pnpm smoke:composition` invocations, each headed by its md5. The md5s are the point: `red/healthy.txt`,
`red/R1-nondentry-dangling-subpath.txt` and `red/R3-manifest-advertises-outside-surface.txt`
share one digest (`665df744…`), and `red/R2b-gate-indented-own-import-…` shares the digest of
the healthy run of its own tree (`026e4626…`, same as `green/G-healthy-all-fixes.txt` and
`mut/M-A-gate-dangling-subpath.txt`) — which is the exact sense in which a defective artifact
"printed the healthy output": not a paraphrase, a digest match. That `026e4626…` output is also
what the column-0 scanner and the pre-fix subpath rule produced on a **clean** artifact, and it
differs from the pre-round capture only in the install-surface arm's sentence and three shifted
stack-trace lines. |

### The offline composition-surface checks, and the line between them and the SKIP

A gate that stops checking has to be replaced by a gate that checks, so the nine
`client bundle <check-id>` arms verify the composed artifact
(`packages/client/composition-shim/`) — the thing a real host actually loads — with **no
upstream closure at all**: the bundle's only bare specifiers are the four module-table
externals. They cover the defect classes the coordinator named: a missing plugin-row
export (`plugin-row-exports`), a wrong artifact or manifest path
(`composition-output-present`, `manifest-targets-resolve`, `shim-recorded-values` —
asserted against the manifests the builder itself writes), our own top-level code throwing
(`bundle-module-graph-evaluates`), drift in what the bundle may require
(`external-specifier-set`, read both from the emitted `__extReq` text and from an
evaluation that runs even when the load step skips), a glue/seam mismatch against
`packages/runtime/dist` (`derived-urls-resolve`, which derives the URLs with the built
host's own `defaultGlueUrl` / `defaultSeamUrlCandidates` and compares the result to
`PLACEMENTS`), and — since the review round, and **not** before it — an advertised path
that lies outside the surface a git install copies (`composition-bundle-is-install-surface`,
see the correction below). Row shape is established by **evaluation** in a `node:vm` context with an
inert module table — the bundle is a `window.__ModuleLoader__.load` script, not a module,
and it touches `document` while its graph evaluates, so `import()` cannot read it; the
stub surface is deliberately minimal so the check cannot rot into a mock that asserts
nothing, and its own `apply` was never trusted for the fail-loud contract (that stays on
the load step, where the real upstream exists).

#### Correction (review round, 2026-10-08): what `composition-bundle-is-install-surface` did NOT cover

The paragraph above credited that arm with part of the "wrong artifact or manifest path"
class, and named `INSTALL_SURFACES` as the shared source that made it one-directional.
Both claims were false for the arm as written. It compared `expectations.bundleInstallPath`
against `installSurfaces`, and the caller hands it both from `client-composition-surface.mjs`
(`CLIENT_BUNDLE_INSTALL_PATH` *is* `CLIENT_COMPOSITION_DIR + '/' + CLIENT_BUNDLE_FILENAME`;
`INSTALL_SURFACES` *contains* `CLIENT_COMPOSITION_DIR`), so the comparison was true for
every artifact state and the arm could not fail. Measured: pointing the built shim
manifest's `exports["./client"]` at an existing file outside both surfaces left the arm
printing its usual PASS and the gate exit 0 (receipt `7-5-review-round-mutations.txt`,
R-3a). The arm now reads the paths the built shim manifest actually advertises and fails
on any of them falling outside a surface, or on the manifest advertising nothing at all;
`CLIENT_BUNDLE_INSTALL_PATH` remains a constant for the builder and for readers, with a
comment there saying in as many words not to build a gate arm out of comparing it.

The honest limit, stated where it belongs: **this removes a gate that was not testing
anything; it does not make the client plugin verifiable in this workspace.** Driving the
real client row inside a real host is Task 7.6/7.7, and human acceptance stays
`BLOCKED` / `NOT_RUN`.
