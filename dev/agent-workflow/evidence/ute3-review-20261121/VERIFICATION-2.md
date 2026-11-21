# UTE G1 — adversarial verification round 2 (post-#817/#818)

**Reviewer:** independent adversarial (read-only worktree, uncommitted report)
**Worktree:** `.worktrees/ute3-review-20261121` @ `task/ute3-review-20261121`
**Reviewed master:** `c25cb576fbb8524f53d718082b4e3f2c9ecd44cc` (#818), with #817 at
`04cd61e67027a191594050f7723419dfe27c0e1e`
**Prior review:** [`REVIEW.md`](./REVIEW.md) at `2b69193fa` — verdict `CLAIMS-EXCEED-EVIDENCE`
**Remediation record:** [`REMEDIATION.md`](./REMEDIATION.md)
**Date:** 2026-11-21

---

## Verdict

**`FIXES-PARTIAL`**

All three original B2 attacks are refused, and B1, B3–B7, B9, B10, B11 are genuinely fixed
(verified by re-running the attacks, reading the code, and reading the hosted #817/#818
evidence). B8 was **my error**, not a defect — see “Corrections to my own review” below: the
`unconfined-fs` mutation is real, is run in CI, and the release request's citation of it was
accurate.

What remains is a set of **inflation paths that the new gate still accepts**, all reproduced
below:

1. `differences: []` is licensed by a self-written magic line — append
   `SD-VERDICT differences=0` to the family's own evidence file, empty the list, flip
   `state`, and the gate prints **ALLOW**. The token is an assertion, not a measurement.
2. A difference reclassified `blocking: false` needs no approval at all; marking all 31
   `false` satisfies `SemanticDifferencesResolved` with **ALLOW** and zero evidence.
3. The approval `reference` only has to be *a non-root ancestor*. A valid record bound to an
   **unrelated** merge (`1d64aeb45`, #815) is accepted; nothing binds the commit to the
   difference or to the approval file.
4. The `_selftest/` namespace is **not excluded** by the gate and **not audited** by the
   `APPROVALS` test: a committed
   `dev/agent-workflow/approvals/_selftest/fs-forged.json` naming a production family would
   pass both. The README's “It cannot licence a real family” is true of the one shipped file,
   not of the namespace.
5. The 87-file set is complete for `src/` + rows (verified 0 undeclared, 0 missing in all 8
   families), but it omits the **generated** `packages/tools/families/index.mjs`,
   `manifest.json` and `index.d.mts`, which statically import/list all 8 family rows. Deleting
   exactly the 87 leaves a broken import graph.
6. The absolute-path cleanup is **partial**: the ledger-cited transcripts are clean, but
   `dev/agent-workflow/evidence/ute3-search-b1-20261120/{README.md,lane-suite.txt}` and
   `ute3-search-b2-20261120/lane-suite.txt` still contain `/home/armourpiercer/...`; the
   remediation's verification grep simply did not include them.

None of these is as wide as the original B2 (which needed no evidence at all). But the first
two mean a family can still reach `ALLOW` without measuring anything or getting a signature.

---

## 1. B2 re-attack matrix

All attacks run with `checkTerm` / `evaluateFamily` against a `/tmp`-equivalent in-worktree
script (`.tmp/`, deleted after use) using the real `fs` row and the real census; no tracked
file was modified and nothing was committed. “state” means the row's `state` field.

| # | attack | expected | observed |
| --- | --- | --- | --- |
| A0 | original: `differences: []` + `verdict:true` + `state:RETIREABLE`, no token | refuse | **ALLOW** before; now `UTE_DIFFERENCES_UNDECLARED` + `UTE_SEMANTIC_DIFFERENCES_UNRESOLVED` (refused) |
| A1 | same, with `SD-VERDICT differences=0` appended to the term's own evidence | refuse if the token is not a measurement | **ALLOW** (`terms=4/4`, `state=RETIREABLE`). Reproduced. |
| B0 | original: `blocking:"yes"` + `verdict:true` | refuse | refused (`UTE_DIFFERENCE_SCHEMA_INVALID`) |
| B1 | `blocking` absent | refuse | refused (`UTE_DIFFERENCE_SCHEMA_INVALID`) |
| B2 | `blocking: 1` | refuse | refused (`UTE_DIFFERENCE_SCHEMA_INVALID`) |
| C0 | original: record = release-request `.md`, `reference` = **root** commit | refuse | refused (`UTE_APPROVAL_RECORD_INVALID` + `UTE_APPROVAL_UNREFERENCED`) |
| C1 | valid `ute-approval/1` record, `by` disagrees with the ledger | refuse | refused (`UTE_APPROVAL_RECORD_INVALID`, plus `UTE_EVIDENCE_CONTRADICTED`) |
| C2 | valid record naming the wrong difference | refuse | refused (`UTE_APPROVAL_RECORD_INVALID`) |
| C3 | valid record, `reference` = root commit | refuse | refused (`UTE_APPROVAL_UNREFERENCED`) |
| C4 | valid record, `decision: deferred` | refuse | refused (`UTE_APPROVAL_RECORD_INVALID`) |
| C5 | valid record, untracked file | refuse | refused (`UTE_APPROVAL_RECORD_INVALID` via `isTracked`) |
| C6 | valid record, `reference` = unrelated **non-root ancestor** (`PR #805 @ 1d64aeb45`) | should refuse (no relation to the difference) | **established=true** at term level; with a committed record the family would be **ALLOW**. Reproduced with injected `isTracked`; an end-to-end run needs one committed record, which is a visible act, not a hidden bypass. |
| C7 | valid record at `approvals/_selftest/fs-forged.json` naming family `fs` | should refuse (`_selftest` is fixture-only) | **established=true**. `isInsideApprovals` accepts it (`scripts/ute-retirement-gate.mjs:296-301`) and the `APPROVALS` test allows every `_selftest/` file (`scripts/ute-retirement-gate.test.mjs:919-924`). |
| D1 | non-empty list, **all** entries `blocking:false`, `verdict:true`, `state:RETIREABLE` | arguably refuse (classification is unverified) | **ALLOW** (`terms=4/4`). No approval, no evidence. |

Notes:

- A1 is the escape hatch the remediation itself asks about. `checkZeroDifferencesMeasurement`
  (`scripts/ute-retirement-gate.mjs:752-784`) reads `term.evidence.path` and greps for the
  exact token. The family chooses that path; the file is its own committed doc. The token is
  not produced by any comparison tool in the tree (`grep -rn "SD-VERDICT differences=0"`
  finds it only in the gate, its tests and the mutants). The code comment calls it “the
  committed measurement”; it is a string.
- D1 is not introduced by #817 — literal `blocking:false` was always honoured — but #817 now
  makes the schema explicit, so this is the remaining unbounded input. `blocking` is a claim
  the gate cannot verify, and with all entries false the term is satisfied vacuously.
- C6 is the “unrelated merge” case the task names. The gate checks shape, existence,
  ancestry and non-root-ness (`:862-890`); it never checks that the commit touched the
  approvals file, the difference's evidence, or this family at all. The README's honest limit
  covers *entitlement* (`dev/agent-workflow/approvals/README.md:113-121`), not relatedness.
- C7 is a structural gap, not a live one: the shipped tree has only
  `_selftest/synthetic-difference.json` with `family: "synthetic-selftest"`, and #817's
  `APPROVALS` test asserts zero production-family *directories*. But the test's per-file rule
  is `README || _selftest/`, so a forged `_selftest/<production>.json` passes it, and the gate
  accepts any path under `approvals/`.

---

## 2. Per-finding verification (B1, B3–B11)

| # | status | evidence / file:line |
| --- | --- | --- |
| **B1** web controls unexecuted | **FIXED** | `tests/ute-g1-web/lane-suite.test.mjs:150-172` executes the battery, requires the exact `NC-VERDICT GREEN controls=11 failed=0` line, `deepEqual`s the whole transcript, and runs `UTE_WEB_NC_MUTATE=drop-widening` which must exit 1 with `NC-VERDICT RED controls=11 failed=1`. Hosted proof on #818: `UTE-G1-WEB-CONTROLS GREEN controls=11 transcript=exact mutated=RED` (census job 136757743432). |
| **B1b** fs/search/uistate shrinkable | **FIXED** | fs: exact `results.length === 13`, named control ids, `deepEqual` fresh vs committed (`tests/ute-g1-fs/lane-suite.test.mjs:107-131`). uistate: exact 13 + transcript (`tests/ute-g1-uistate/lane-suite.test.mjs:148-167`). search: exact 8 family + exact 12 B2 + transcript (`tests/ute-g1-search/lane-suite.test.mjs:237-242`). Hosted: `NC-VERDICT GREEN controls=13`, `controls=8`, `UTE-G1-UISTATE-CONTROLS … transcript=exact`. |
| **B3** “20 booked members” | **FIXED** | `PROGRESS-2026-11-21.md:29` and `RELEASE-REQUEST-2026-11-21.md:53` now say **27 = 4+2+2+3+2+7+2+5**; the matrix's member column sums to 27. Census + gate derive 27. |
| **B4** 77-file deletion set | **FIXED for the declared set; residual plan gap** | All 8 families: declared == actual `src/` files + the assembly row, 0 undeclared, 0 missing; total **87** (`fs` 17 = 16 src + row). Verified programmatically against each `packages/tools/*-family/src/`. Residual: `packages/tools/families/index.mjs` (generated, imports all 8 rows), `manifest.json` (lists all 8 with digests) and `index.d.mts` are not in the set and are not mentioned in §5/§6; deleting only the 87 leaves `index.mjs` importing a missing `./fs.mjs`. `EB3-FAMILY-DEFINITIONS files=88` is fine — the 88th is the out-of-scope `tests/u6-arc-a-probe-family/src/probe-contribution.mjs`, not a missing body file. |
| **B5** stale FS golden meta | **FIXED** | `tests/ute-g1-fs/golden/old-path.meta.txt:105-113` now says “NOW REPRODUCED”, cites `PROTOTYPE-VERDICT GREEN vectors=16 failed=0`, and keeps the honest “beyond those vectors” limit. The lane suite asserts the two stale sentences are absent (`tests/ute-g1-fs/lane-suite.test.mjs:98-105`). |
| **B6** Group B overreach | **FIXED** | `RELEASE-REQUEST:151-193` splits the five into separate questions: web = repo's own `dsh-agent-team/web-tool` (host package not mounted), agent-control = ungraded claim, inspect = alias→rename, ui = `present` mounted / `ask_user_question` unmounted (PD-25), AS = all five mounted. Ledger summaries match (`SD-WEB-1`, `alias-to-native-name-change`, `SD-UI-two-implementations`, `SD-AS-two-implementations`); uistate source statement now says “SIX of the SEVEN” (`tests/ute-g1-uistate/lib/semantic-differences.mjs:27`). |
| **B7** route-absent claim | **FIXED** | Both ledger summaries and `tests/ute-g1-uistate/lib/semantic-differences.mjs:141` now say: bare route registers none; preset serves `present` + all five agent-state names; `ask_user_question` absent by PD-25; the governed **body** is what is not mounted. Verified against `composition-probe.txt:60-93` (`PROBE-DISPOSITION … inherited-preset-row` for all five AS, `present` on the preset scope). **My earlier count of “5 of 7” was wrong; 6 of 7 is correct** (see corrections). |
| **B8** “nonexistent control” | **WITHDRAWN — my error** | `unconfined-fs` is real: `tests/ute-g1-fs/product-route-image.test.mjs:268` `test('MUTATION unconfined-fs: …')`, also documented at `dev/agent-workflow/evidence/ute3-routec-image-20261120/README.md:55` and in the router log. It is in the census CI argv (`census-runtime.yml:434`), and it is exactly “a lane denial → 70-byte allow”. The release request's original citation was **accurate**; the replacement with `NC-MEMBER read_image` / `widen-read-lane-image` is also accurate but was unnecessary. `REMEDIATION.md:18` now repeats “nonexistent control”, which is false. |
| **B9** wrong partition | **FIXED** | `dev/agent-workflow/evidence/ute3-review-20261121/partition.mjs` derives from the ledger and prints `PARTITION VERDICT GREEN groups=5 total=31 unique=31 ledger=31 counts=A7,B5,C4,D14,E1`; the release request's §4 enumerates the same ids (`RELEASE-REQUEST:143-240`). Each of the 31 ledger ids appears once. |
| **B10** `process.oldBaseline` | **FIXED** | Ledger `oldBaseline.verdict:false` (`ute-retirement.json:460`); matrix says `1/2 (pwsh uncovered)` (`RELEASE-REQUEST:47`); gate now emits `UTE_OLD_BASELINE_MISSING` for process (verified in `--all --json`). |
| **B11** stale search note | **FIXED** | `ute-retirement.json:239` now records PR B2's 15/15 (`NEW-PATH-VERDICT GREEN vectors=15`) and keeps only the real blocker (three unapproved differences). |

Non-blocking items from the first review:

| item | status |
| --- | --- |
| `NegativeControlsPass` 6/8 vs gate 7/8 | **FIXED** — `RELEASE-REQUEST:26` says 7/8 |
| search “12 controls” conflated | **FIXED** — `PROGRESS:20` says “8 family controls (+12 B2 new-path controls)”; `RELEASE:81` says the same |
| absolute host paths in FS/search evidence | **PARTIAL** — ledger-cited files clean; `ute3-search-b1-20261120/README.md`, `ute3-search-b1-20261120/lane-suite.txt`, `ute3-search-b2-20261120/lane-suite.txt` still contain `/home/armourpiercer/...` (the remediation grep omitted them) |
| “two byte-identical captures” universal | **NOT ADDRESSED** — `RELEASE:23` still states it for all families; fs/process still have a single capture transcript each (process ends `compare=identical` against the fixture), not a committed pair |
| socket witness fail-open on host-less bag | **FIXED** — `tests/ute-g1-web/lib/net-witness.mjs:86,105` (and `:109` for the unknown shape) classify `<unknown>` → external; the control drives `connect({port:443})` and requires `EGRESS_REFUSED`, `external=2` (`negative-controls.mjs:267-285`) |
| vacuous `installed` conjunct | **FIXED** — uses `networkWitnessInstalled()` |
| control-battery shrinkability | **FIXED** — exact counts + transcript `deepEqual` for fs/search/web/uistate; agentctl/process already did |
| `tests=892` needs CI flags | **FIXED** — `PROGRESS:87` cites `node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7` |
| `master 1d64aeb45` header | **FIXED** — matrix header now says “reviewed master `2b69193fa`” (the actual reviewed base) |
| `NC-MEMBER-POSITIVE edit` synthetic vector | **NOT ADDRESSED** (minor) — still compares only `outcome`/`refusal`, not the full row |

New wording issue introduced by the fix: `RELEASE-REQUEST:316-320` now says “deleting these 87
files **does not remove every capability** a user can currently reach”, which contradicts the
next sentence (“change nothing observable”); the earlier “does not remove **any** capability”
was overbroad for opt-in plane configs, but “not every” implies some capability is lost. The
honest formulation is “removes no capability on the shipped preset (no plane key is set);
removes the opt-in governed body for an install that turns a family on”.

---

## 3. Corrections to my own first review

1. **B8 was wrong.** I wrote that `unconfined-fs` “does not exist anywhere”. It is a real
   test (`tests/ute-g1-fs/product-route-image.test.mjs:268`), CI-collected, and it does
   exactly what the release request said. My own parenthetical in `REVIEW.md` even admitted
   the real arm existed, which should have stopped the finding. The release request's
   citation was valid; the remediation's replacement is harmless but the premise is false.
2. **`contradicts` count was misstated.** I wrote “all 68 `contradicts` strings are absent”.
   The ledger has **7**, at both `2b69193fa` and `c25cb576f`, and all 7 are absent. The 237
   `expect` count was correct.
3. **“5 of 7 names served” was wrong.** The probe's `PROBE-DISPOSITION` lines show `present`
   plus **all five** agent-state members are served on the preset (6 of 7, `ask_user_question`
   the exception). The remediation's “6 of 7” is correct; my review undercounted by one.

I re-ran the B2 attacks from scratch rather than trusting the new tests, and I reproduced
the three original ALLOWs against `2b69193fa` again before testing the fixes (they now all
refuse).

---

## 4. Re-verified facts on `c25cb576f` (things that changed)

- **Tokens / paths:** 237 `expect` tokens, **0 missing**; 7 `contradicts`, **0 fired**; 32
  evidence paths, all present and `git ls-files`-tracked.
- **Gate summary:** `requested=8 allowed=0 refused=8`; all 8 `state=NOT_RETIREABLE`; per-family
  codes as expected (fs/search only `UTE_SEMANTIC_DIFFERENCES_UNRESOLVED`; process now includes
  `UTE_OLD_BASELINE_MISSING`; web/agent-control/ui/agent-state include
  `UTE_NEW_PATH_UNVERIFIED` + `UTE_VECTOR_UNREPRODUCED`).
- **Differences:** 31 total, 0 approvals, 27 booked members (census), 87 declared old-path
  files (all exist), partition 7/5/4/14/1 by id.
- **Captures:** search run 1 == run 2 (`ac9f6457…`, changed from `a3333719…` because paths were
  redacted), web `64cdb621…`, uistate `cb3c4902…` — byte-identical pairs still hold.
- **Hosted:** #817 head `9c7bb240…` and #818 head `b2243ee…`; both runs' `headSha` equals the PR
  head; all 11 checks green including `ci-census / census-runtime` (24m30s, 21m33s);
  `assertions_executed=18650 skipped_total=0`, `DSH-CI-LEG leg=census verdict=pass`;
  `UTE-RETIREMENT-GATE-MUTANTS total=20 red=20` (local gate suite 45/45).
- **Approvals:** only `README.md` + `_selftest/synthetic-difference.json`; 0 production
  records.

---

## 5. What I could NOT check

- **Live re-runs in this worktree.** It has no `tests/deepseek-harness-test-use` /
  `tests/deepseek-harness-next` (gitignored; a fresh `git worktree add` does not copy them),
  so I could not execute the lane suites, the captures or the controls locally. I ran
  `scripts/ute-retirement-gate.test.mjs` (host-free, 45/45) and read the hosted #817/#818 logs
  for the lane evidence. I did not create or write those symlinked trees.
- **A genuinely committed forged approval.** C6/C7 were demonstrated at the term level with
  injected `isTracked`/`readFile`; I cannot commit a record, so the end-to-end ALLOW for those
  two is inferred from the term result plus the gate's only remaining check (record committed
  under `approvals/`). A1 and D1 are full `evaluateFamily` ALLOWs with only the ledger and one
  evidence line changed.
- **The approval record's human entitlement** (unchanged limit) and whether a real owner
  would ever sign one.
- **The `_selftest` test-loophole end-to-end** — same reason as above; the code path is
  unambiguous (`isInsideApprovals` + the `APPROVALS` file rule).

---

## 6. Reproduction

```bash
cd /home/armourpiercer/projects/dsh-agent-team
git fetch origin
# in the review worktree @ 2b69193fa:
git merge --ff-only origin/master               # c25cb576f
node --test scripts/ute-retirement-gate.test.mjs            # 45/45
node scripts/ute-retirement-gate.mjs --all --json           # allowed=0 refused=8
node dev/agent-workflow/evidence/ute3-review-20261121/partition.mjs
# attacks (scripts kept in .tmp/, deleted after use):
#   A1  fs row: differences:[] + verdict:true + state:RETIREABLE
#       + append "SD-VERDICT differences=0" to tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md
#   D1  fs row: both differences blocking:false + verdict:true + state:RETIREABLE
#   C6  valid ute-approval/1 record bound to 1d64aeb45 (non-root ancestor, unrelated merge)
#   C7  same record at approvals/_selftest/fs-forged.json
gh pr checks 817; gh pr checks 818
gh run view 44871790226 --json headSha ; gh run view 44874587910 --json headSha
gh api repos/ArmourPiercer1/dsh-agent-team/actions/jobs/136757743432/logs | grep -E 'UTE-G1-WEB-CONTROLS|assertions_executed'
```

No tracked file was modified; the only addition is this untracked `VERIFICATION-2.md`.
