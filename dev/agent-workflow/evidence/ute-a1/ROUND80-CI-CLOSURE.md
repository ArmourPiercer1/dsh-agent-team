# Round 80 — the hosted-CI closure (P0: the Required path was red on the A0/A1 cut)

Dated 2026-11-22. Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut` (sole writer).
Review under execution: `docs/reviews/20261122-2305.txt` §3, second P0.

At HEAD `5cf7cba8a3` the hosted Required path was: `pr-gate` PASS, `ci-security` PASS,
`ci-product` PASS, `ci-fast` PASS, **`ci-integration` FAIL**, **`ci-census` not executed**,
**`ci-required` FAIL**, **`pr-settlement-gate` FAIL**. The product was cut and green; the
INSTRUMENTS that graded the retired surface were not cut with it, and the census baseline still
booked the deleted plane.

Nothing in this round restores a retired module, edits A0 frozen evidence, widens a skip, removes
a negative control, or patches upstream. Every retirement below is per SUBJECT with a citation
into the frozen inventory/decision and a NAMED successor that carries the guarantee now.

## 1. The findings, decomposed (counts measured, not estimated)

`node scripts/eb3-family-definitions.mjs` at HEAD: **473 findings**, exit 1.

| # | code | count | what it actually is |
|---|---|---|---|
| 1 | `DEF_CENSUS_DRIFT` | 10 | 9 booked Family Contribution files + the ARC-A probe contribution: rows in `arc-a-family-census.json` whose file A0 deleted |
| 2 | `INVENTORY_PATH_MISSING` | 180 | declared old-path files absent from the working tree (the cut) |
| 3 | `INVENTORY_PATH_UNTRACKED` | 129 | the same files not in the git index (they no longer exist) |
| 4 | `INVENTORY_RUNTIME_PATH_BROKEN` | 83 | runtime-path steps naming those same deleted files |
| 5 | `INVENTORY_AUTHORITY_INVALID` | 44 | the per-family authority files: the five frozen runtime authority files + the census/inventory authority sets they name |
| 6 | `INVENTORY_DEPENDENCY_UNKNOWN` | 27 | declared dependencies read from files that are gone |
| | **total** | **473** | one cause: the inventory + census ledgers book the A0-retired plane |

The 463 inventory-arm findings are `9 families × their declared files/steps/authority` plus
**11 `shared` entries** (`team-tool-plane.mjs`, `family-assembly.mjs`, `agent-bindings.mjs`,
`tool-dispatch/install.ts`, `pre-execute-adapter.ts`, `governance-center/{kernel,index,registry}.ts`,
`packages/tools/families/{index.mjs,index.d.mts,manifest.json}`). Every one of those 11 is inside
the A0 frozen delete set. The three `shared` entries that are NOT frozen (`control/service.ts`,
`controlled-fs/src/index.ts`, `sandbox-provider/index.ts`) are `KEEP` and still present — they
produce no finding, which is the correct discrimination.

Adjacent reds from the same cause (measured at HEAD):

| instrument | red at HEAD | count |
|---|---|---|
| `scripts/eb3-tool-acceptance.mjs` | `ACCEPT_PROVEN_UNBACKED` — every L1 PROVEN cites a suite the cut deleted | 31 |
| `scripts/eb3-ci-negative-controls.mjs` | C3, C3b, C3c, C4, C20 | 5 of 35 |
| `scripts/ute-family-inventory.test.mjs` | fixture bound to the pre-cut tree | 2 failing tests |
| `scripts/ute-p0-assets.test.mjs` | `derive()` walks the post-cut tree ⇒ 33 empty modules | 5 failing tests |
| `scripts/ute-cut-closure.test.mjs` | placement arm graded foreign `--root` fixtures with the real build face | 3 failing tests |
| `scripts/ute-retirement-gate.test.mjs` | REAL/CLI arms graded the row against the post-cut tree | 2 failing tests |
| `ci-census` | `DSH-CENSUS-REFUSED code=POPULATION_SHRANK` (`packages/runtime` −102 files, `packages/tools` −1, `packages/tools/a5p5-tools` root absent) | 1 refusal |
| `pr-settlement-gate` | no dated settlement comment carrying the head sha | 1 requirement |

## 2. Disposition of every category

The licence is `dev/agent-workflow/ledgers/ute-cut-closure.allow.json#retiredSurfaces`
(schema `ute-a0-retired-surfaces/1`), **12 subjects**: the 8 booked families, the ARC-A probe lane,
and the three instruments whose subject was the surface (`tool-acceptance-claims`,
`family-lane-edges`, `family-inventory-records`). Each row names its frozen modules, its citations
(the reviewed inventory entry, the keep/delete decision, the A0 snapshot module, and the round-72
per-file `retiredSubjects` record) and its successors.

The record is a LICENCE, not a silence. `ude-cut-closure --check` (and every consumer) refuses a
row whose citation is untracked, whose module is not delete/replace in the snapshot, whose kind is
outside the closed set, or whose successor path does not exist (`A0_RETIRED_*`). A family whose
declared surface is not wholly inside the frozen set is graded as LIVE
(`INVENTORY_RETIREMENT_UNEARNED`), so a partial resurrection cannot hide behind the record.

| category | disposition | citation | successor |
|---|---|---|---|
| 10 `DEF_CENSUS_DRIFT` | RETIRE per subject | `ute-p0-assets.snapshot.json#module-family-*` / `#module-governance-closed-world` (probe); `01-ASSET-INVENTORY.md` §each | native lane suites + `ute-cut-closure --check` + `ute-p0-assets --check` |
| 463 inventory findings | RETIRE per family + per shared file | same snapshot modules; 11 shared files all frozen | `eb3-family-definitions` structural laws stay live; absence facts reported as `DEF_RETIRED_BY_A0` |
| 31 `ACCEPT_PROVEN_UNBACKED` | RE-POINT the claim set to the frozen A0 tree; RETIRE the cited suites per file | `retiredSurfaces#tool-acceptance-claims`; the 11 suites are all in `retiredSubjects` (round 72) | the cited RECORD still exists and passes; `vnext-admission` + lane suites |
| C3, C3c, C4 | RE-POINT the mutation staging to the A0 blob (same laws, same mutations) | `retiredSurfaces#frozenTree` | unchanged: the controls still fire |
| C3b | RE-EXPRESS: the frozen `families/fs.mjs` is now a CUT deletion, so the unlicensed-deletion law is staged on a non-frozen declared file; the frozen branch is asserted as discharged | `retiredSurfaces#frozenTree` | both halves asserted in one control |
| C20 | SAME INPUTS as the leg (`retiredSuitePaths`) | — | honest ledger passes, four mutations still refused |
| 12 census node:test failures | RE-BASE the fixture on the A0 frozen tree (option (a) of `MIGRATED-SUITE-STATUS.md` §6.2) | `retiredSurfaces#frozenTree` | mutation batteries preserved: inventory 32/32, p0-assets 21, cut-closure 13, retirement-gate 45 |
| 3 cut-closure failures | FIX the instrument: the build-face arm graded a foreign `--root` with THIS repo's placements | n/a — a real bug | `placements=self|fixture` in the check line |
| `POPULATION_SHRANK` | REGENERATE the baseline with an attributed reason | `retiredSurfaces` + `retiredSubjects` | baseline 712 → 599, roots 12 → 11, reason recorded |
| `ci-census`/`ci-required` not green | two successor legs added to REQUIRED `ci-integration` | `dev/ci/eb3-ci-manifest.json` | `ute-cut-closure --check`, `ute-p0-assets --check` |

### 2.1 Why `eb3-family-definitions` was NOT deleted

It stays, and it is not vacuous. What it still grades on every PR: the family set both directions,
member/lane/mount/definition parity, the census booking, the retirement-ledger licence
(`DEF_RETIREMENT_UNLICENSED`), and the A0 discharge itself. What it no longer pretends to grade is
the CONTENT of a surface that does not exist. The negative control that pins this
(`C7` asserts the leg is selected by the family path) still passes, and the manifest/impact graph
still names the leg.

## 3. The successor guarantee

The retirement hands the guarantee to four instruments, all on the Required path after this round:

1. `scripts/ute-p0-assets.mjs --check` — the frozen 37-module / 180-file boundary: 146 delete,
   2 replace, 32 keep; `cut(148/148)`, no residual, no unlisted file. **Newly REQUIRED** in
   `ci-integration` (before this round it ran in NO CI layer; only its unit test ran, in census).
2. `scripts/ute-cut-closure.mjs --check` — the dependency closure of the cut: 148 deleted sources,
   0 production references, 0 dist residuals, 0 duplicate declarants, every exemption per-file and
   every production referrer disposed; it also validates the retirement record. **Newly REQUIRED**.
3. `tests/checks/eb3-ute-migrated-suites.txt` — 15 suites / 238 tests, `passed=238 failed=0`, the
   bound vitest leg (`eb3-security-run --layer ci-integration`).
4. The native execution-centre suites — `tests/ute-g1-{fs,search,web,process,agentctl,uistate}/lane-suite.test.mjs`,
   `tests/ute1-fs/native-fs-binding.test.mjs`, `packages/runtime/test/vnext-admission.test.mjs`
   (the `ute-vnext-a1` dispatch leg: 7 suites / 206 tests, exit 0).

Every subject in the record names at least one of these as its successor, and the record validator
refuses a successor that is not a tracked file — so the handoff cannot be a claim without a target.

## 4. Per-job verdicts — the ACTUAL hosted commands, run locally

(Filled from the final run; see §5 for the exact lines. "hosted-only" is marked UNPROVEN, never PASS.)

| job | command | verdict |
|---|---|---|
| job (workflow) | command | verdict |
|---|---|---|
| `pr-gate` (all 10 legs, census included) | `node scripts/ci-pr-gate.mjs --full --census-captures 2 --allow-refused census --census-test-timeout 90000` | **PASS** — `DSH-CI-VERDICT pass pass=10 fail=0 skip=0 refused=0` (290 s) |
| `ci-fast` (docs layer) | `eb3-merge-tree --assert-tree`; `eb3-impact`; `docs-probe`; `docs-sync --check` | **PASS** — docs-sync `findings=0 blocking=0`; the other three need the hosted merge-tree/base inputs → **UNPROVEN locally**, by construction |
| `ci-product` | the eight host-free legs, run inside the `--full` gate above (`--only` list per `ci-product.yml`) | **PASS** — all eight green; `typecheck` clean; `lint-identities new 0, resolved 13`; `artifacts-at-head` `compared=1940 drift=0` |
| `ci-integration` | `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt` + the layer's own steps (`eb3-family-definitions`, `eb3-family-boundaries`, `eb3-tool-acceptance`, `ute-cut-closure --check`, `ute-p0-assets --check`) | **PASS** — `suites=15 files=15 passed=238 failed=0`; family-definitions `findings=0`; tool-acceptance `findings=0`; both successor legs `pass` |
| `ci-security` | `eb3-security-run --timeout 20000` | **PASS** — `suites=14 files=14 describes=61 passed=216 failed=0` |
| `ci-census` (census-runtime workflow) | `ci-pr-gate --full --only census --census-execution plan --census-captures 2 --census-test-timeout 90000` | **PASS** — 22 tasks / 11 roots / 2 captures, 7412 assertions each, identical identity sets, population 599 = baseline 599 (`growth=none added=0`) |
| `ci-required` (`grade` job) | `scripts/eb3-merge-tree.mjs --grade-needs` over GitHub's `toJSON(needs)` | **UNPROVEN** — needs the hosted `needs` payload; locally `eb3-ci-required` grades the workflows against the manifest `workflows=10 findings=0` |
| `pr-settlement-gate` | `gh api` comments + `scripts/pr-settlement-gate.mjs` | **PASS after the settlement comment** — first line `[dated settlement, 2026-11-22 …]`, 40-hex head sha = the pushed head (§5). Before the comment the gate is FAIL by construction; it was never "made" green |
| `next-host` (census lane, `tests/deepseek-harness-next`) | `ci-census` lane includes it | **PASS locally** — the pinned rc.5 host is materialized and built here; on a hosted runner without it the lane REFUSES by name (that is a refusal, not a pass) |

## 5. The exact lines (no hand-written counts)

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c4…

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
DSH-TEST-CATALOG tests=785 collected=733 excluded=14 uncollected=38 refused=0 findings=0

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared

$ node scripts/place-dist-glue.mjs .
place-dist-glue: done (29 placement(s))

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000

$ node scripts/eb3-family-definitions.mjs
EB3-FAMILY-DEFINITIONS pass files=0 findings=0 retiredFamilies=9 retiredCensusRows=10 retiredByCut=87

$ node scripts/eb3-tool-acceptance.mjs
EB3-TOOL-ACCEPTANCE pass tools=31 L4-proven=19 L4-disclosed=11 L4-unverified=1 retiredSuites=31

$ node scripts/eb3-ci-negative-controls.mjs
35/35 control(s) behaved as required

$ node scripts/ci-pr-gate.mjs --full --census-captures 2 --allow-refused census --census-test-timeout 90000
DSH-CI-LEG leg=census verdict=pass seconds=246.5 …
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=290.1
```

The four census-lane node suites, after the re-base (these are the twelve reds at HEAD):

```
$ node --test scripts/ute-retirement-gate.test.mjs scripts/ute-family-inventory.test.mjs \
    scripts/ute-p0-assets.test.mjs scripts/ute-cut-closure.test.mjs
ℹ pass 118  ℹ fail 0
# inside them: inventory mutant battery 32/32, p0-assets 21, cut-closure 13, retirement-gate 45
```

## 6. What still needs an OWNER (not repairable from this tree)

1. **The settlement comment cannot be posted by this agent beyond the licence it has.** It is posted
   here with `gh api` as `ArmourPiercer1` (the authenticated owner) on PR #822, first line
   `[dated settlement, 2026-11-22 …]`, body carrying the exact 40-hex head of the pushed commit.
   If the reviewer wants the PR to stay a draft, the comment is harmless; if the PR is closed and
   the branch reused, the head changes and the settlement must be re-posted (§8.5.5: a NEW dated
   comment, never an edited one).
2. **`ci-required`'s `grade` job needs GitHub's `needs` payload.** It cannot be proven locally; the
   manifest half (`eb3-ci-required`) is proven. The hosted run of the pushed head is the proof, and
   until it exists this row is UNPROVEN.
3. **`ci-census` on a fresh hosted runner still needs a provisioned rc.5 host** to execute the
   `next-host` lane; if it is absent the lane REFUSES by name (`NextHostMissingError`) and the
   census workflow's own grading decides. Locally the host is present and the lane passed.
4. **The PR is still a DRAFT with no labels** and `ci-census` is deferred while it stays a draft:
   mark it ready (`gh pr ready 822`) — the settlement comment is what the settlement gate grades,
   readiness is what makes the census job actually run on the pushed head.
