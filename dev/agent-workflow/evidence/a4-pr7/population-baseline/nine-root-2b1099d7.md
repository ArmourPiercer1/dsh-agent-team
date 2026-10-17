# POPULATION BASELINE — NINE-ROOT SCOPE (authoritative from 2026-10-17; supersedes nine-root-319a60d7.md as the gate pointer)
# ┌─ READ THIS FIRST ─────────────────────────────────────────────────────────────────────────────┐
# │ THIS BASELINE WAS MEASURED AT 2b1099d7 — the GLUE-2 commit on branch alpha5-glue-a5p5, based  │
# │ on origin/master @ aece4f21; master had not moved at capture time, so the branch tree and the │
# │ CI merge-ref tree are the SAME TREE (the caliber ruling below is satisfied by equality, not    │
# │ by argument). CURRENT CORPUS AT THE END OF THIS FILE: 558 files / 7010 registered legs / 9     │
# │ titled reds / 0 collection-error files. The tolerated identity set IS the "titled reds"       │
# │ section below; machine-readable copy nine-root-2b1099d7.ids.txt — BYTE-IDENTICAL to            │
# │ nine-root-319a60d7.ids.txt (cmp verified in the same breath as the copy): nine lines, nothing │
# │ moved, added, or softened across THREE restatements. scripts/ci-pr-gate.mjs BASELINES.census   │
# │ points HERE. Predecessors stay UNEDITED as history: nine-root-319a60d7.md (the merge-tree      │
# │ restatement round), nine-root-067225df.md, nine-root-2162f6a7.md (the full lineage).           │
# tree: 2b1099d7 (alpha5-glue-a5p5 on origin/master aece4f21, porcelain 0)              captured: vitest --reporter=json, all nine packages/*/test roots + the two explicit root-config entries
# roots: contracts domain legacy remote runtime storage testkit tools client
# files 558 | registered legs 7010 | titled reds 9 | collection-error files 0
#
# WHY THIS FILE EXISTS (and why the corpus moved 551/6941 → 558/7010 without one tolerance moving):
# GLUE-2 (coordinator queue gaps C-11+C-01) wired the tools Search/Shell lane's SEVEN test files
# (69 legs, all green at capture — no new red entered on any capture) into the ROOT vitest config
# and its lane src into that package's build compile face, with the lane's own dormant-audit
# released in the same round under a form-pinned exception (WIRING-SURFACE.md GLUE-2 section holds
# the disclosure; the shared barrel still does not know the lane). This is exactly the restatement
# the predecessor's last paragraph obligated: the root-collected corpus moved, so the totals are
# re-recorded HERE, in the open, by measurement (two same-run captures, identical sets, verdict
# pass) — the gate never writes its own baseline.
# The CALIBER ruling is carried forward unchanged: the CI census grades the PR MERGE-REF, so the
# baseline caliber is the tree the census runs on; the identity set (the verdict substrate) is
# caliber-invariant, only the CONTEXT counts differ; a totals mismatch is context per the LOAD
# DISCIPLINE below — but a merge-ref restatement that moves the corpus is recorded here.
# From the predecessor's WHY paragraph, one historical sentence is carried on purpose — one lane's
# extra red (packages/tools/test/p6t6-actions.test.ts > messaging: worker -> leader ...) reproduced
# at master OUTSIDE the old universe — because that path sits in the baseline prose and the gate's
# family parser mines prose: family disclosures are part of the interface. The family set parsed
# out of this document MUST equal the predecessors' {p6t1-parallel, packages/tools/test/p6t6-actions
# .test.ts} — assert it the same way totals are.
#
# LOAD DISCIPLINE: the titled-red COUNT moves with load (19, 20, 21 seen on near-identical trees --
# the p6t1-parallel family). Compare IDENTITY SETS, never totals, and always name your roots.
#
## titled reds (file > full name), sorted:
# CURRENT AT 2b1099d7 (restated 2026-10-17). THIS SECTION IS A MACHINE INTERFACE, NOT PROSE.
# scripts/ci-pr-gate.mjs parses the lines below into the set of TOLERATED red identities. A line here
# means: this red is known, and a fresh run may not blame it on the change under review. It does NOT
# mean the obligation is met -- every one of these 9 lines is disclosed debt with a named green pin.
# The nine are byte-identical to nine-root-post-d3-4-split.ids.txt across all three restatements;
# nothing retired, nothing added, no tolerance created. The retired identities and their green
# successors live in the 2162f6a7 document, which keeps the full history (12 retirements, the D3-4
# repair with mutation control, the round-38 correction) and is NOT re-narrated here.
packages/domain/test/t2-blueprint-hash.test.ts > t2 hash: hashable projection projects absent optional singles as explicit null
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 1. no grant → MEDIATED via the leader: input on the leader session, nothing on the peer session, the coordination fact keeps the intended recipient
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 3. grants are PER-SENDER: worker2 holds no grant of its own (the grant on the other worker does not apply) → still mediated
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 4. a newer overlay generation without the grant revokes it (latest generation wins, fail closed → mediated again)
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 5. authority beats mediation: the scout envelope denies send-message, so the facade rejects it — zero writes, no coordination fact
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 7. the relay text + attribution carry the correlation and the intended-for identity (mediated and direct)
packages/runtime/test/p6t3-restart.test.ts > P6-T3 restart durability + pending-delivery recovery 2. the pending MEDIATED intent is recovered onto the LEADER session (the plan is re-derived from the fresh state)
packages/runtime/test/p6t3-restart.test.ts > P6-T3 restart durability + pending-delivery recovery 5. recovery aborts on the first hard failure (R5): earlier confirmations stay durable; the clean retry recovers ONLY the remainder
packages/tools/test/p6t6-actions.test.ts > P6-T6 tool set — delegated actions (unit level) messaging: worker -> leader is delivered direct to the leader bound session

## collection-error files (a red that resolves into one of these is an ESCALATION, not a fix):
# NONE at 2b1099d7 — the rule survives in full force: a titled red that resolves INTO a collection
# error is an escalation, never an improvement, because a file that dies at collection contributes
# no identity to either set — the mechanism that hid 32 legs for a whole stage (2162f6a7 lineage).
## CENSUS-LOAD RACE FAMILY — two legs fixed on this branch, disclosed with rates, NOT exempted

The nine-root census runs files across workers; two legs asserted properties that only hold when
the process or filesystem is quiet, and the census (both CI and a constructed local churn) caught
them. Both were repaired TEST-SIDE in the observe-robustly-never-assume shape (retry until the law
is SEEN / skip only entries that vanished), with RED and GREEN logs in
dev/agent-workflow/evidence/alpha5/wiring/:
- the poc3 fd-recycling leg (runtime controlled-fs probes): worker threads share the fd table, a
  single open could miss the recycled number; the leg now probes up to 500 times and stays RED if
  recycling is never observed (d1409059; census-RED-vs-9-baseline.txt / FINAL-GATES.txt).
- the a5p7 hygiene walk (runtime test dir, module-load): an entry that vanished between readdir and
  stat threw ENOENT and killed the whole FILE at collection — the mechanism of the capture-DIFFER
  (6941 − 6937 = this file's 4 legs) in CI run 38973673638. Old code 3 reds / 7 churn runs, fixed
  code 3/3 green under the same 18-way churn (788db2fd + 067225df;
  a5p7-COLLECTION-RACE-RED.log, a5p7-COLLECTION-RACE-GREEN.log, a5p7-COLLECTION-RACE-GREEN2.log).
Neither leg is on the tolerance list and neither path is written out in family-granting prose:
their guards are observational (a red after them is a genuine red), so granting them the
re-sample protocol would weaken what the fixes were for.

## CLOSED OBSERVATION — the two CI-census-only reds of runs 38973673638 / 38980065316

The 067225df document recorded as an OPEN OBSERVATION (no mechanism, no exemption) two reds that
appeared only in CI union grading: the a5p1r G-5 wording-lint leg and the p4t6 denylist-coverage
leg. The caliber ruling above IS the mechanism: both are COUNT/CONTENT-pinned repository scans,
and CI scanned the MERGE tree while every local capture scanned the branch-only tree — the branch
could not reproduce what only the merged content contains. Measured on the merged tree both failed
on the first local try (dev/agent-workflow/evidence/alpha5/wiring/p4t6-GGPROBES-merge-tie-RED.log:
`expected 1157 to be 1155` + the WIRING-SURFACE wording violation), and both were repaired in
319a60d7 — the p4t6 tie for PR #265's two files booked in the merge-correction ledger (same class
as PR3/PR5/PR7; the assertion stays razor-tight, it is not an exemption), and the wording line
rewritten to carry its qualifier. The observation closes WITH its mechanism and its local rate
explained (0/12 was true of the branch caliber, not of the graded one). Nothing was exempted;
nothing here is family-granted.

## PUBLISHED LOAD FAMILY (carried verbatim from the predecessors; the rate is the quote)

Three lanes have read this file as "p6t1-parallel is a load flake, green solo 9/9". **Measured on `8dcfbe4f` at
rest, solo, eight consecutive runs with `rm -rf packages/testkit/test/.tmp-fault` before each: 6 passed, 2 failed**
(one run 3 red legs, one run 2 red legs; a nine-root census run showed 5 of 9 red; sample assertions
`expected 1 to be +0` and `expected 1 to be 2`). **Solo failure rate ~2/8 — green solo is a SAMPLE, not a property.**

Operational rule from now on, for every lane: a red inside this family is dismissed only by **at least three
re-samples whose rate you publish**, never by one green re-run; and a census reported as `NEW 0` that contains a
p6t1 red must state how many re-samples it took. Re-derivation is in flight on `fix-a4-p6t1-flake`
(evidence `dev/agent-workflow/evidence/a4-pr7/p6t1-flake/`); until that lands, **quote the rate, not the label.**

---

## CURRENT CORPUS (the sentence scripts/ci-pr-gate.mjs reads for its totals)

Measured at `2b1099d7` (branch tree == merge-ref tree, porcelain 0; pristine host built at
@639ed01539, client lane built, `.tmp-fault` cleared, private `XDG_CACHE_HOME`, `--testTimeout=90000`
as the workflow passes): one `--census-captures 2` run — two captures — reporting the IDENTICAL
identity set, `verdict=pass`, new 0 / resolved 0 / escalations 0, the poc3 fd leg green in both
captures (its rate record lives in the coordinator's G-f ledger, not here):

At `2b1099d7`: 558 files / 7010 registered legs, 9 titled reds, 0 collection-error files, nine roots
named (contracts domain legacy remote runtime storage testkit tools client).

The grammar note from the predecessors still governs: `lastDeclaredTotals()` matches `N files / M legs` or
`files N | registered legs M`, highest character offset across both shapes — **a document a machine parses is
an interface: what you add to it changes the gate, so re-measure the parse instead of trusting the prose.**
This paragraph is the last totals sentence on purpose.

**Provenance:** the capture pair ran on the 2b1099d7 worktree (porcelain 0 for the graded pathspecs);
the commits carrying this document add, beyond the glue itself, only evidence + baseline files + the
pointer and self-test pins in `scripts/ci-pr-gate.mjs` — no further `packages/` movement after the
capture is the checkable claim: `git diff --name-only 2b1099d7 HEAD -- packages/` empty.

**Distance from the predecessor corpus, stated exactly:** 558 − 551 = 7 files, 7010 − 6941 = 69 legs —
GLUE-2's seven newly root-collected lane test files, sixty-nine legs, all green at capture (no
tolerance line was added, retired, or edited; the ids file is a byte copy). The identity set did not
move one line.
