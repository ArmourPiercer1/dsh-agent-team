# POPULATION BASELINE — NINE-ROOT SCOPE (authoritative from 2026-10-26 U7-1/EB2-C; supersedes nine-root-2b1099d7.md as the gate pointer)
# ┌─ READ THIS FIRST ─────────────────────────────────────────────────────────────────────────────┐
# │ THIS BASELINE IS THE FIRST ONE WITH AN **EMPTY** TOLERATED SET. It was measured at           │
# │ 27a818456 (task/u7-1-old-red-closure-20261026 on origin/master 97bbc2563, porcelain 0 for    │
# │ the graded pathspecs). CURRENT CORPUS AT THE END OF THIS FILE: 626 files / 7936 registered   │
# │ legs / 9 titled reds RETIRED / 0 collection-error files / 0 tolerated identities.            │
# │ The nine identities the predecessor tolerated are discharged one by one in the RETIREMENT    │
# │ section below, and `scripts/ci-pr-gate.mjs` REFUSES this document unless that table EQUALS   │
# │ the predecessor's tolerated set exactly — a zero is expressible here only as a claimed,      │
# │ named, per-identity retirement, never as nine deleted lines. Predecessors stay UNEDITED as   │
# │ history: nine-root-2b1099d7.md (the pointer until now), nine-root-319a60d7.md,               │
# │ nine-root-067225df.md, nine-root-2162f6a7.md (the full lineage).                             │
# tree: 27a818456 (task/u7-1-old-red-closure-20261026 on origin/master 97bbc2563)     captured: vitest --reporter=json, all nine packages/*/test roots
# roots: contracts domain legacy remote runtime storage testkit tools client
# files 626 | registered legs 7936 | titled reds 0 | collection-error files 0
#
# WHY THIS FILE EXISTS: U7-1 / EB2-C ("complete the nine-package 9 reds and the 22 Root old reds:
# attribute, reproduce, exit; FIX named races rather than delete security tests"). The nine
# census-tolerated reds were reproduced on this tree first (they were still 9/9 red at 27a818456
# BEFORE the test-side repair in the same commit chain) and then discharged. The retirement is a
# TEST-SIDE OBSERVER REPAIR, not a deletion and not a weakening: every leg keeps every assertion,
# and each repaired leg is proven non-vacuous by a planted-wrong-value mutation control
# (dev/agent-workflow/evidence/u7-1-old-reds-20261026/mutation-controls.sh + mutation-logs/).
# The evidence set — attribution, verbatim reproduction, exits, the retirement table and the
# mutation controls — is dev/agent-workflow/evidence/u7-1-old-reds-20261026/OLD-REDS.md and
# old-reds.json.
#
# WHAT CHANGED, IN THE TWO CAUSES THE WHOLE SET COLLAPSED TO (see OLD-REDS.md for the per-row
# attribution):
#   1. commit 3be0de1f "fix messaging relay to root leader" (shipped in the user-ruled
#      0.1.0-rc.1 release) routes LEADER-directed delivery to the ROOT session, matching the
#      frozen Architecture §9.2 ("LeaderInstance is root Agent/Session, has no childSessionId").
#      Eight legs kept observing — and one kept FAULT-INJECTING into — the seeded leader's legacy
#      `childSessionId`: they read an empty inbox, and the injector stopped firing. They were
#      observers of a premise that moved. This lane re-pins the observer to the root session and
#      asserts the legacy child session stays SILENT (mediation leg 1), so the same move cannot
#      go unwatched again.
#   2. commit 5ad6a4fe8 (0.1.1-alpha.1 T1; plan §5.6 "new capability fields MUST enter the
#      Blueprint normalized/hash representation") added `capabilities` (absent ⇒ explicit null)
#      to the per-template hashable projection. One literal was never completed.
# Neither repair touches product source: the tree under `packages/**/src/**` and every other
# product file is byte-identical to 27a818456's parent (the fix commits touch tests, this
# baseline, the gate's census parser and its self-test only).
#
# LOAD DISCIPLINE is unchanged and still governs: compare IDENTITY SETS, never totals, and always
# name your roots (the titled-red COUNT moves with load -- the p6t1-parallel family). An empty
# tolerated set does NOT mean the suite is expected green forever — it means the debt that was
# tolerated is discharged and any new red is NEW, which is the stricter reading.
#
# THE DISCLOSED FAMILY SET NARROWS FROM TWO TO ONE, and this is the stricter direction, stated so
# nobody reads it as a loss: the gate mines this document's prose for load families and grants a
# red inside one the >=3-re-sample protocol. The predecessors' set was {p6t1-parallel, the p6t6
# tool-set actions file}. The second entry was a family ONLY because its path sat in a WHY
# paragraph (2b1099d7 says so in its own words: "that path sits in the baseline prose and the
# gate's family parser mines prose"). Its red was never a load red — it was the deterministic
# 3be0de1f premise move retired below — so carrying it forward would keep a re-sample excuse alive
# for a file whose only red is now FIXED. It is deliberately not named as a path in this prose.
# The p6t1-parallel family stays, verbatim, and still governs any future red inside it.
#
## titled reds (file > full name), sorted:
# CURRENT AT 27a818456 (2026-10-26 U7-1/EB2-C). THIS SECTION IS A MACHINE INTERFACE, NOT PROSE.
# scripts/ci-pr-gate.mjs parses the lines below into the set of TOLERATED red identities. It is
# EMPTY ON PURPOSE, and `# RETIRED-TO-EMPTY:` below is the machine line that says so. Without that
# sentinel an empty section REFUSES (a renamed heading must never read as "nothing is failing");
# with it, the parser additionally requires the RETIREMENT section to name exactly the predecessor's
# tolerated set, count matching, no more and no fewer. Do not "restore" a line here by hand.
# RETIRED-TO-EMPTY: 9 titled reds retired against predecessor 2b1099d7

## collection-error files (a red that resolves into one of these is an ESCALATION, not a fix):
# NONE at 27a818456 — and none at the predecessor either. The rule survives in full force: a titled
# red that resolves INTO a collection error is an escalation, never an improvement, because a file
# that dies at collection contributes no identity to either set.

## RETIREMENT — the nine tolerated identities, one line each (MACHINE-PARSED, must equal 2b1099d7's set)
# This section is the binding. `parsePopulationBaseline` compares these lines, as a SET, against
# `nine-root-2b1099d7.md`'s tolerated identities and refuses the document on any difference — fewer
# lines is a silent deletion, more is invented debt. `evidence/u7-1-old-reds-20261026/old-reds.json`
# carries the same nine rows with exclusion class, owner and evidence pointer.
packages/domain/test/t2-blueprint-hash.test.ts > t2 hash: hashable projection projects absent optional singles as explicit null
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 1. no grant → MEDIATED via the leader: input on the leader session, nothing on the peer session, the coordination fact keeps the intended recipient
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 3. grants are PER-SENDER: worker2 holds no grant of its own (the grant on the other worker does not apply) → still mediated
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 4. a newer overlay generation without the grant revokes it (latest generation wins, fail closed → mediated again)
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 5. authority beats mediation: the scout envelope denies send-message, so the facade rejects it — zero writes, no coordination fact
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 7. the relay text + attribution carry the correlation and the intended-for identity (mediated and direct)
packages/runtime/test/p6t3-restart.test.ts > P6-T3 restart durability + pending-delivery recovery 2. the pending MEDIATED intent is recovered onto the LEADER session (the plan is re-derived from the fresh state)
packages/runtime/test/p6t3-restart.test.ts > P6-T3 restart durability + pending-delivery recovery 5. recovery aborts on the first hard failure (R5): earlier confirmations stay durable; the clean retry recovers ONLY the remainder
packages/tools/test/p6t6-actions.test.ts > P6-T6 tool set — delegated actions (unit level) messaging: worker -> leader is delivered direct to the leader bound session

## PUBLISHED LOAD FAMILY (carried verbatim from the predecessors; the rate is the quote)
# Still in force for any FUTURE red inside these files: the re-sample protocol is not suspended by
# an empty tolerance, it simply has nothing to excuse today.
#
# Three lanes have read this file as "p6t1-parallel is a load flake, green solo 9/9". **Measured on `8dcfbe4f` at
# rest, solo, eight consecutive runs with `rm -rf packages/testkit/test/.tmp-fault` before each: 6 passed, 2 failed**
# (one run 3 red legs, one run 2 red legs; a nine-root census run showed 5 of 9 red; sample assertions
# `expected 1 to be +0` and `expected 1 to be 2`). **Solo failure rate ~2/8 — green solo is a SAMPLE, not a property.**
#
# Operational rule, unchanged: a red inside this family is dismissed only by **at least three
# re-samples whose rate you publish**, never by one green re-run.

## PUBLISHED LOAD FAMILY — the p4t6 census race, FIXED at this restatement (disclosed, not exempted)
# A THIRD race was found and repaired by this lane, and it is disclosed here because it is exactly
# the class this baseline's own protocol exists for: `a4p7-merge-gate.test.ts` planted its two
# lint-universe CONTROL files (`lint-scratch-control-a.mts`, `-b.mts`) under
# `packages/testkit/test/`, i.e. inside the corpus `p4t6-session-event-scan.test.ts` walks at module
# load and pins as an exact `filesScanned` total. The root suite runs those two files in parallel
# workers, so when the ~50 s window of the merge-gate leg overlapped the ~20 ms p4t6 scan, p4t6
# counted two files that belong to no commit and went red. MEASURED, both directions, on this tree:
#   - p4t6 ALONE, controls absent:            10 passed (10)  — three consecutive runs
#   - p4t6 with the two control files on disk: 1 failed | 9 passed, `expected 1279 to be 1277`
#   - p4t6 with both controls RELOCATED to `scripts/` (which is outside the `packages/**` walk):
#     10 passed (10), three consecutive runs
#   - and the controls keep their power where they moved: `lint-identities` universe
#     1385 → 1387 files with the two planted, i.e. they are still linted, still counted.
# The repair is a relocation of the control files' LOCATION, not a relaxation of any assertion; the
# merge-gate leg still asserts the universe moves by exactly the number of files it plants
# (measured: 1 passed at 129 s after the move). The red was a function of SCHEDULING, never of the
# tree — which is why it appeared in the 20000 ms `pr-gate` census leg and not in two independent
# local captures, and why it is fixed here rather than tolerated.
#
# Unrelated to that, and NOT a race: `rc2-sanitize-evidence` S13 declares `timeout: 60_000` for a
# nested `node --test` and this suite sets no global `testTimeout`, so at vitest's 5000 ms default
# it can be forfeited rather than measured. It is green under the CI clocks (20000 in `pr-gate`,
# 90000 in `census-runtime`, both printed on the leg line). It is not tolerated here: it is green
# under the clocks CI actually uses, and the clock in force is stated on every census leg line.

---

## CURRENT CORPUS (the sentence scripts/ci-pr-gate.mjs reads for its totals)

Measured at `27a818456` (porcelain 0 for the graded pathspecs; pristine host provisioned and built
in-worktree at @639ed01539 with porcelain 0 before and after, `pnpm build` + `pnpm build:composition`
run so the composition arms RUN rather than refuse): two captures of the root vitest run over the
nine roots, `--testTimeout=90000`, `rm -rf packages/testkit/test/.tmp-fault` before each capture, a
private `XDG_CACHE_HOME`:

At `27a818456`: 626 files / 7936 registered legs, 0 titled reds (9 retired), 0 collection-error
files, nine roots named (contracts domain legacy remote runtime storage testkit tools client).
Both captures report the IDENTICAL (empty) identity set, `fail-set` capture 0 identities each.

**Provenance:** the captures ran on this worktree; the commits carrying this document add this
baseline, the retirement evidence, the gate's census-parser sentinel + its self-test, and the two
TEST-side repairs. The checkable claim that no product semantics moved with them:
`git diff --name-only <parent-of-the-test-repair>..HEAD -- 'packages/*/src/**'` is empty.

**Distance from the predecessor corpus, stated exactly:** 626 − 558 = 68 files, 7936 − 7010 = 926
legs. The corpus grew because master moved eight commits; the IDENTITY set moved from nine tolerated
reds to zero, and every one of the nine is named in the RETIREMENT section above.
