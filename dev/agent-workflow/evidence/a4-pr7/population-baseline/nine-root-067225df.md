# POPULATION BASELINE — NINE-ROOT SCOPE (authoritative from 2026-10-17; supersedes nine-root-2162f6a7.md as the gate pointer)
# ┌─ READ THIS FIRST ─────────────────────────────────────────────────────────────────────────────┐
# │ THIS BASELINE WAS MEASURED AT 067225df (branch alpha5-int-wiring, porcelain 0). ITS FIGURES ARE │
# │ IN "CURRENT CORPUS" AT THE END OF THIS FILE: 549 files / 6936 registered legs / 9 titled reds  │
# │ / 0 collection-error files. The tolerated identity set IS the "titled reds" section below;     │
# │ machine-readable copy: nine-root-067225df.ids.txt (byte-identical to nine-root-post-d3-4-split │
# │ .ids.txt — the nine lines did NOT move). scripts/ci-pr-gate.mjs BASELINES.census points HERE.  │
# │ The predecessor document nine-root-2162f6a7.md stays in this directory UNEDITED as history —   │
# │ its totals (508 / 6373 at adec09f5) had gone stale: PR3 (74d947a3), PR5 (d69bfc4b) and PR7     │
# │ (fc9f4a07) merged ~43 files / ~563 legs into the nine roots without a restatement, and this   │
# │ wiring branch added 2 files / 16 legs. CI census run 38973673638 @ 2c955133 said so in the    │
# │ open: "captured 551f/6941l, 551f/6937l vs baseline-declared 508 / 6373 … identity sets DIFFER".│
# │ Numbers here are MEASURED, not re-narrated — the adec09f5 precedent's own rule.                │
# tree: 067225df (branch alpha5-int-wiring, porcelain 0)   captured: vitest --reporter=json, all nine packages/*/test roots
# roots: contracts domain legacy remote runtime storage testkit tools client
# files 549 | registered legs 6936 | titled reds 9 | collection-error files 0
#
# WHY THIS FILE EXISTS: the population moved twice under a pointer that did not. The 2162f6a7
# document remained TRUE about its identity set (the nine reds below are exactly its nine, no
# tolerance was added, moved, or renamed — verify by the ids byte-equality above), but its declared
# corpus went stale by a whole merge series, and a reader who trusted only its header would grade a
# post-merge tree against a pre-merge corpus. This file restates the corpus at the post-merge tree
# and keeps every disclosure the predecessor carried: the identity list, the collection-error rule,
# and the load families below, carried verbatim where they were verbatim. From the predecessor's WHY
# paragraph, one historical sentence is carried on purpose — one lane's extra red (packages/tools/test/p6t6-actions.test.ts >
# messaging: worker -> leader ...) reproduced at master OUTSIDE the old universe — because that path
# sits in the baseline prose and the gate's family parser reads prose: family disclosures are part
# of the interface, and a restatement that silently dropped one would change the gate's re-sample
# semantics under the prose. The family set parsed out of this document MUST equal the predecessor's
# {p6t1-parallel, packages/tools/test/p6t6-actions.test.ts} — assert it the same way totals are.
#
# LOAD DISCIPLINE: the titled-red COUNT moves with load (19, 20, 21 seen on near-identical trees --
# the p6t1-parallel family). Compare IDENTITY SETS, never totals, and always name your roots.
#
## titled reds (file > full name), sorted:
# CURRENT AT 067225df (restated 2026-10-17, branch alpha5-int-wiring). THIS SECTION IS A MACHINE INTERFACE, NOT PROSE.
# scripts/ci-pr-gate.mjs parses the lines below into the set of TOLERATED red identities. A line here
# means: this red is known, and a fresh run may not blame it on the change under review. It does NOT
# mean the obligation is met -- every one of these 9 lines is disclosed debt with a named green pin.
# The nine are byte-identical to nine-root-post-d3-4-split.ids.txt; nothing retired, nothing added,
# no tolerance created by this restatement. The retired identities and their green successors live
# in the predecessor document (nine-root-2162f6a7.md), which this file supersedes as POINTER only —
# its full history (12 retirements, the D3-4 repair with mutation control, the round-38 correction)
# stays readable there and is NOT re-narrated here.
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
# NONE at 067225df — the rule survives in full force: a titled red that resolves INTO a collection
# error is an escalation, never an improvement, because a file that dies at collection contributes
# no identity to either set — the mechanism that hid 32 legs for a whole stage (predecessor doc).

## CENSUS-LOAD RACE FAMILY — two legs fixed this round, disclosed with rates, NOT exempted

The nine-root census runs files across workers; two legs asserted properties that only hold when
the process or filesystem is quiet, and the census (both CI and a constructed local churn) caught
them. Both were repaired TEST-SIDE in the observe-robustly-never-assume shape (retry until the law
is SEEN / skip only entries that vanished), with RED and GREEN logs in
dev/agent-workflow/evidence/alpha5/wiring/:
- the poc3 fd-recycling leg (runtime controlled-fs probes): worker threads share the fd table, a
  single open could miss the recycled number; the leg now probes up to 500 times and stays RED if
  recycling is never observed (d1409059; census-RED-vs-9-baseline.txt / FINAL-GATES.txt).
- the a5p7 hygiene walk (runtime test dir, module-load): an entry that vanished between readdir and
  stat threw ENOENT and killed the whole FILE at collection — this is the mechanism of the CI
  DIFFER above (6941 − 6937 = this file's 4 legs). Old code 3 reds / 7 churn runs, fixed code 3/3
  green under the same 18-way churn (788db2fd + 067225df; a5p7-COLLECTION-RACE-RED.log,
  a5p7-COLLECTION-RACE-GREEN.log, a5p7-COLLECTION-RACE-GREEN2.log).
Neither leg is on the tolerance list and neither path is written out in family-granting prose:
their guards are observational (a red after them is a genuine red), so granting them the
re-sample protocol would weaken what the fixes were for.

## OPEN OBSERVATION AT THIS BASELINE (not an exemption): CI-census-only reds, named by stem to avoid the family grant

CI run 38973673638 (capture pair 2026-10-16T22:1xZ) put two reds into its union that no local
capture has ever shown: the a5p1r G-5 wording-lint leg and the p4t6 denylist-coverage leg (the one
whose title carries the ledger prose). Local re-samples on this branch: 0 reds in 12 captures
(six at the CI tree content, six at this tree) plus the 3-run census green above; solo legs green
everywhere, every time. Mechanism NOT identified (no stack survived in the CI tail window), NOT
labelled a flake, NOT exempted, NOT family-granted — quoted by rate, per the round-38 rule: if a
future census adds either identity, its re-samples must be published and a surviving red is a red.

## PUBLISHED LOAD FAMILY (carried verbatim from the predecessor; the rate is the quote)

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

Measured at `067225df` (branch alpha5-int-wiring, porcelain 0; pristine host built at @639ed01539,
client lane built, `.tmp-fault` cleared, private `XDG_CACHE_HOME`, `--testTimeout=90000` as the
workflow passes): three consecutive `--census-captures 2` runs — six captures — all reporting the
IDENTICAL identity set, `verdict=pass`, new 0 / resolved 0 / escalations 0, every one:

At `067225df`: 549 files / 6936 registered legs, 9 titled reds, 0 collection-error files, nine roots
named (contracts domain legacy remote runtime storage testkit tools client).

The grammar note from the predecessor still governs: `lastDeclaredTotals()` matches `N files / M legs` or
`files N | registered legs M`, highest character offset across both shapes — **a document a machine parses is
an interface: what you add to it changes the gate, so re-measure the parse instead of trusting the prose.**
This paragraph is the last totals sentence on purpose.

**Provenance, stated so the next reader need not re-run everything:** the three green pairs ran on the
067225df worktree (porcelain 0); the commit that carries this document changes NOTHING under
`packages/` (evidence + baseline files + the pointer line in `scripts/ci-pr-gate.mjs` only), so the
measurement transfers to it — and to any tree with the same `packages/` content — by tree equality,
not assertion: `git diff --name-only 067225df HEAD -- packages/` empty is the checkable claim.

**Distance from the predecessor corpus, stated exactly:** 549 − 508 = 41 files, 6936 − 6373 = 563 legs —
PR3 +11, PR5 +19, PR7 +14 files as booked in the p4t6 merge-correction ledger (p4t6-session-event-scan
SCANNED_PATHS_A5WIRING), plus this branch's own two files (admission-binding.ts + its wiring suite)
and the leg deltas the merged test files registered. The identity set did not move one line.
