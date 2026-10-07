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
