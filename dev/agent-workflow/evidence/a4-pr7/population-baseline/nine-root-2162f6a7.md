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
