# Main-agent ruling B-G4R-3 — G4-R phase 3 boot budget and scope — 2026-10-28

**What this rules.** The scope and boot budget of the G4-R live leg (phase 3): all five gate items
re-run on ONE freshly frozen clean candidate — ARC-A 1 + ARC-B 1 + ARC-D 1 + Jobs 1 + crash
survivor 2 = **6 boots, hard ceiling 8** — which **exceeds the envelope in
[G4-PROMOTION-REVIEW-R1.md](./G4-PROMOTION-REVIEW-R1.md) by 3, disclosed**. It also adopts a new
evidence rule for equivalence rows (bottom of this document's finding 2 / the ledger row).

**Issued by.** The incoming main agent, 2026-10-28, during takeover reconciliation round 2 (the
round that re-scoped R-G4R-2, re-opened R-G3-1 / R-REM-1 on the candidate, and merged #427 / #428 /
#429). Recorded as one appended row in [GATE-LEDGER.md](./GATE-LEDGER.md).

**Depends on.** [G4-PROMOTION-REVIEW-R1.md](./G4-PROMOTION-REVIEW-R1.md) — its G4-R envelope and the
standing rule "No over-budget boots without a new main-agent ruling";
`dev/agent-workflow/evidence/u7-g4i-20261028/DEPENDENCY-EQUIVALENCE.md` — the equivalence envelope
this ruling refuses to carry any item on; the measurements in "Inputs established this round"
below, all reproducible from the commands shown; and the user standing ruling that boot-budget
extensions are executed **with disclosure as over-budget**, never silently.

**Nature.** This is an **authorization + disclosure, not a gate verdict**. It changes no gate
status: G4 stays `G4-CORE-PASS / BRIDGE-BLOCKED` (2026-10-26, unchanged by the 2026-10-28 promotion
re-review R1), and promotion remains the promotion reviewer's call in R2. The document is tracked
because the live boot legs that follow require a tracked authorization in front of them.

---

Issued by the incoming main agent. Authority: `G4-PROMOTION-REVIEW-R1.md` ("No over-budget boots
without a new main-agent ruling"); user standing ruling that boot-budget extensions are executed
**with disclosure as over-budget**, never silently.

## Inputs established this round (all reproducible)

1. **`R-G4R-2` was misattributed.** The carried risk reads "this host cannot create unprivileged
   user namespaces ⇒ every native workspace-write leg is ENV_BLOCK here". Measured:
   `bwrap` is indeed unusable, but the host's Landlock launcher works — from the main runtime
   checkout `probe()` returns `partial`. The G4-R phase-2 worktree returned `unusable` because
   `native/system/packages/*/bin/` is **gitignored** (`native/system/.gitignore: packages/*/bin/`)
   and the documented fresh-worktree provisioning (`git clone --local --no-hardlinks`,
   TEST_METHODS §2) does not copy untracked files. The same leg genuinely PASSED on 2026-10-26
   (`landlock-run: partial enforcement (older Landlock ABI)`,
   `u7-4a-jobs-producer-20261026/logs/u5u74a-…/u74a-main-4.u74a-evidence.json`) —
   PASSED *under partial Landlock enforcement*; `partial` is an admissible launcher state by this
   ruling's own precondition below (`partial` or `full`), and no partial⇒`full` equivalence is
   claimed here or needed by the verdict. A provisioning gap was recorded as a product-level FAIL.
   *(Location note for a cold reader: `native/system/.gitignore` is in the host runtime tree, not
   this repo — at the test checkout it is `tests/deepseek-harness-test-use/native/system/.gitignore`
   line 4 `packages/*/bin/`; the Team repo tracks no `native/system` directory, which is exactly
   why the fresh worktree's runtime clone lacked the launcher binaries.)*
2. **`R-G3-1 / R-REM-1` equivalence does not reproduce.** The tracked gate doc cites teamSha
   `d8f40c0d` (correctly: `live/crash-reclaim-1/run-u5-crash-2026-10-28T05-53-32-928Z.json`) and
   asserts `git diff d8f40c0d..HEAD -- packages scripts` is empty. Measured against current master,
   against the R1 doc's own stated input master `1e3ec41a6`, and against the #421 branch's final
   head `72e51b1f9`, that diff is **34 files** in all three cases (the #418 agent-control family
   plus `packages/tools/families/manifest.json`). Under the envelope defined in
   `u7-g4i-20261028/DEPENDENCY-EQUIVALENCE.md` this is AFFECTED, like every other receipt.
   Detail: `.artifacts/findings/R-G3R-EQUIV-20261028.md`.

   The working note just named is **gitignored scratch**, so the measurement is restated here; a
   tracked reader can re-verify from these commands alone (all reproduce in a fresh worktree;
   re-checked 2026-10-28 in the worktree that produced this PR, where master = `a23f11a3b`; the
   same three counts were independently recomputed by the R2 reviewer at master `c2b03fc34`, also
   34 (review `.artifacts/reviews/R431-R2-d2-flash.md`, check 1)):

       $ git diff --name-only d8f40c0d origin/master -- packages scripts | wc -l
       34
       $ git diff --name-only d8f40c0d 1e3ec41a6 -- packages scripts | wc -l   # the R1 doc's own stated input master
       34
       $ git diff --name-only d8f40c0d 72e51b1f9 -- packages scripts | wc -l   # the #421 branch's own final head
       34

       $ git merge-base --is-ancestor e6589ef5f d8f40c0d ; echo $?
       1        # #418 (AC-1) is NOT an ancestor of the record's teamSha

   The 34 paths are the #418 agent-control family merged after that record:
   `packages/tools/agent-control-family/src/*.mjs` and their placed `dist` twins,
   `packages/tools/families/agent-control.mjs`, `packages/tools/families/manifest.json`,
   `scripts/dist-placements/070-agent-control-family.json`, plus runtime tests and the p4t6
   booking. The claim "later deltas are tests/world-factory + evidence only" could only have been
   true in the few hours before #418 merged, and was copied forward without recomputation.
   **New evidence rule adopted with this ruling:** an equivalence row must cite the record's own
   `teamSha` read out of the JSON, name the reference commit, and carry the verbatim diff output;
   a prose "is empty" is not evidence.
3. **The envelope covers `tests/world-factory`.** `dependency-results.json` method line: "Every
   production package input plus all **World/kit execution modules** … A changed member causes
   AFFECTED; no hunk exemptions claimed." `arc-d-dependencies.txt` contains 63 such paths.
   Therefore the sandbox-provisioning fix and the ARC-B seam both invalidate the existing
   candidate-bound records by their own law, and no record survives into phase 3 on equivalence.

## Ruling

**Phase 3 runs all five items on ONE freshly frozen clean candidate, after every runner change is
merged.** No item may be carried by equivalence, because (a) the equivalence law now demonstrably
breaks for the crash-survivor row, and (b) the World-execution-module clause means the pending
runner changes invalidate the ARC-A and ARC-D bindings anyway.

| # | item | runner | starts |
|---|---|---|---|
| 1 | ARC-A (centre integrity + search legs) | `u5-canary-runner.mjs --suite u6-arc-a` | 1 |
| 2 | ARC-B (governed bash) | `u7-tbash-l4-20261027/c2/run-c2.mjs` with the new seam | 1 |
| 3 | ARC-D (adversarial negatives, direct-disk CI-03) | `u5-canary-runner.mjs --suite u6-arc-d` | 1 |
| 4 | Jobs Bridge (real named Bridge) | `u7-4a-jobs-suite.mjs` | 1 |
| 5 | R-G3-1 / R-REM-1 crash survivor | `u5-parallel-supervisor.mjs --mode crash-reclaim` | 2 |
| | **phase-3 total** | | **6** |

**Budget accounting, disclosed.** The G4-R envelope in `G4-PROMOTION-REVIEW-R1.md` is 3 + 1 (ENV or
harness defect fixed in between) + 2 (crash equivalence breaks) = 6. Phase 2 consumed 3 of those
(two ARC-D starts — one lost to an operator omission — and one Jobs start). This ruling therefore
authorises **6 further starts, taking G4-R to 9**, which **exceeds the original envelope by 3**.
It is granted because the overrun is caused by the two defects in inputs 1–2, i.e. exactly the
"ENV or a harness defect fixed in between" class the envelope already anticipated paying for — and
with the explicit disclosure that this class prices at only +1 inside the envelope, so the +2 beyond
that are a **new over-budget authorization by this ruling under the user standing ruling**, not a
claim of in-envelope coverage — and because a single-candidate packet cannot be assembled
otherwise. Every start is declared in its own
lane ledger before the spawn; over-budget status is stated in the PR and the gate doc, not hidden.
**Hard ceiling: 8 starts, +1 reserved strictly for an ENV/harness defect fixed between attempts.**
The crash-survivor pair may collapse to 1 if its first start yields a finalized overall PASS and no
interval re-run is needed; unused starts are not spendable on anything else.
*(Ceiling reading, stated so it is not implicit: the planned total is 3 (phase 2) + 6 = 9, so the
+1 reserve is only real headroom if the crash pair collapses to 1 — the plan consuming 8. If the
pair needs both starts, all 9 authorized starts are plan legs and the reserve is already spent;
a further ENV/harness defect then requires a NEW ruling, it cannot draw on the reserve.)*

**Preconditions, all mandatory before the first spawn:**
- the ARC-B seam fix round (#428) merged;
- the sandbox-provisioning lane merged, **and** its pre-flight probe reporting the launcher as
  `partial` or `full` in the worktree that will boot — a `unusable` pre-flight is a stop, not a leg
  verdict;
- the #427 dated correction merged, so the packet record no longer attributes that FAIL to the host;
- `CANDIDATE.md` naming the frozen SHA committed before any boot; runtime clone porcelain-clean;
  `:3080` probed read-only before and after each leg.

*(Status note, same day: the three merge preconditions are satisfied on master — #427 `89b455f0e`,
#428 `e9d92f963`, #429 `a23f11a3b`. What remains before the first spawn is the candidate freeze
with committed `CANDIDATE.md` and the worktree pre-flight probe.)*

**If the Jobs native leg still cannot run after the provisioning fix**, it is recorded as
`ENV_BLOCK` with the probe receipt and referred to the promotion reviewer as the explicit ruling
`G4-PROMOTION-REVIEW-R1.md` item 3 requires. It is never relabelled PASS, and the Bridge verdict is
not quietly taken to depend on it either way.

## Explicitly not ruled here

- Whether a product-tree-equivalence argument can ever substitute for a same-candidate record:
  that is the promotion reviewer's call in R2, and this round's finding is precisely that it must
  not be granted on an unchecked prose diff.
- Any change to a historical record. The Jobs `overall: FAIL` and the phase-2 ARC-D PASS stand as
  written; only attribution is corrected, by appended dated section.
