# POPULATION BASELINE — NINE-ROOT SCOPE (authoritative from 2026-10-08)
# tree: 2162f6a7 (master, porcelain 0)   captured: vitest --reporter=json, all nine packages/*/test roots
# roots: contracts domain legacy remote runtime storage testkit tools client
# files 500 | registered legs 6262 | titled reds 19 | collection-error files 3
#
# WHY THIS FILE EXISTS: the referee that produced every NEW 0 / RESOLVED 0 claim this stage
# covered FIVE roots only (runtime domain legacy storage contracts = 417 files / 5047 legs)
# and silently ignored tools, remote, testkit and client -- 84 files, including the merge gate
# itself. One lane counted 502/6273 on its own branch and its extra red
# (packages/tools/test/p6t6-actions.test.ts > messaging: worker -> leader ...) reproduced at master
# OUTSIDE the old universe. Comparing a set against a subset is how a clean referee hides a class.
#
# LOAD DISCIPLINE: the titled-red COUNT moves with load (19, 20, 21 seen on near-identical trees --
# the p6t1-parallel family). Compare IDENTITY SETS, never totals, and always name your roots.
#
## titled reds (file > full name), sorted:
packages/domain/test/t1-capability-schema.test.ts > T1: Blueprint Capability Schema 1. Legacy fixture parses without capabilities field
packages/domain/test/t1-capability-schema.test.ts > T1: Blueprint Capability Schema 10. Static source returns legacy mode when capabilities absent
packages/domain/test/t1-capability-schema.test.ts > T1: Blueprint Capability Schema 11. Selective source maps to TemplatePolicy values correctly
packages/domain/test/t1-capability-schema.test.ts > T1: Blueprint Capability Schema 11b. Selective source maps deny entries to values correctly
packages/domain/test/t1-capability-schema.test.ts > T1: Blueprint Capability Schema 2. Leader with full capabilities parses and validates
packages/domain/test/t1-capability-schema.test.ts > T1: Blueprint Capability Schema 3. Members can have different capabilities
packages/domain/test/t1-capability-schema.test.ts > T1: Blueprint Capability Schema 7. Changing capability fields changes the hash
packages/domain/test/t1-capability-schema.test.ts > T1: Blueprint Capability Schema 8. Static source returns selective mode for Leader with capabilities
packages/domain/test/t1-capability-schema.test.ts > T1: Blueprint Capability Schema 9. Static source returns selective mode for MemberTemplate with capabilities
packages/domain/test/t2-blueprint-hash.test.ts > t2 hash: hashable projection projects absent optional singles as explicit null
packages/runtime/test/d3-member-identity-context.test.ts > D3 the member identity context block (Team D1-D6 repair v2, B2) D3-4 FAIL CLOSED: wrong/missing rootSessionId stays rejected at the closed tool layer; a foreign-root setup rejects without installing a block
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 1. no grant → MEDIATED via the leader: input on the leader session, nothing on the peer session, the coordination fact keeps the intended recipient
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 3. grants are PER-SENDER: worker2 holds no grant of its own (the grant on the other worker does not apply) → still mediated
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 4. a newer overlay generation without the grant revokes it (latest generation wins, fail closed → mediated again)
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 5. authority beats mediation: the scout envelope denies send-message, so the facade rejects it — zero writes, no coordination fact
packages/runtime/test/p6t3-mediation.test.ts > P6-T3 member→member mediation (the documented rule, end to end) 7. the relay text + attribution carry the correlation and the intended-for identity (mediated and direct)
packages/runtime/test/p6t3-restart.test.ts > P6-T3 restart durability + pending-delivery recovery 2. the pending MEDIATED intent is recovered onto the LEADER session (the plan is re-derived from the fresh state)
packages/runtime/test/p6t3-restart.test.ts > P6-T3 restart durability + pending-delivery recovery 5. recovery aborts on the first hard failure (R5): earlier confirmations stay durable; the clean retry recovers ONLY the remainder
packages/tools/test/p6t6-actions.test.ts > P6-T6 tool set — delegated actions (unit level) messaging: worker -> leader is delivered direct to the leader bound session
## collection-error files (a red that resolves into one of these is an ESCALATION, not a fix):
packages/runtime/test/p8s3b-result-effects.test.ts
packages/runtime/test/t12a-b2-child-identity.test.ts
packages/runtime/test/t12a-glue-handoff-ports.test.ts
# RE-CONFIRMED at 2f06bb44 (PR #185 = the fail-closed law plus the 54 repaired fixture legs, nine-root on both sides):
# 502 files / 6277 registered legs / 19 titled reds / 3 collection files -- and those 19 are the identities listed
# below VERBATIM (NEW 0, RESOLVED 0). Totals move with the corpus; the identity SET is the baseline.

## PUBLISHED CORRECTION (2026-10-08, round 38) — the p6t1-parallel note above was too comfortable

Three lanes have read this file as "p6t1-parallel is a load flake, green solo 9/9". **Measured on `8dcfbe4f` at
rest, solo, eight consecutive runs with `rm -rf packages/testkit/test/.tmp-fault` before each: 6 passed, 2 failed**
(one run 3 red legs, one run 2 red legs; a nine-root census run showed 5 of 9 red; sample assertions
`expected 1 to be +0` and `expected 1 to be 2`). **Solo failure rate ~2/8 — green solo is a SAMPLE, not a property.**

Operational rule from now on, for every lane: a red inside this family is dismissed only by **at least three
re-samples whose rate you publish**, never by one green re-run; and a census reported as `NEW 0` that contains a
p6t1 red must state how many re-samples it took. Re-derivation is in flight on `fix-a4-p6t1-flake`
(evidence `dev/agent-workflow/evidence/a4-pr7/p6t1-flake/`); until that lands, **quote the rate, not the label.**

Totals also move with merges: at `ac54ffb8` (PR #191, three new §7.6 legs) the nine-root census is
**505 files / 6285 legs / 19 titled reds by identity / 3 collection files**. The identity set listed above stays the
baseline.
