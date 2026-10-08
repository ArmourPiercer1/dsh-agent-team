# POPULATION BASELINE — NINE-ROOT SCOPE (authoritative from 2026-10-08)
# ┌─ READ THIS FIRST ─────────────────────────────────────────────────────────────────────────────┐
# │ A NEWER CAPTURE SUPERSEDES THE COUNTS BELOW. Skip to SUPERSEDED-BY-94da4a69 at the end of     │
# │ this file: tip 94da4a69 = 506 files / 6335 registered legs / 10 titled reds / 0               │
# │ collection-error files, machine-readable set in nine-root-94da4a69.ids.txt. The numbers in    │
# │ the header are the 2162f6a7 capture and are kept as history — but a referee that reads only   │
# │ the header will treat a RESOLVED collection error as expected, which is how 32 legs stayed    │
# │ invisible for a whole stage. Read the end of the file, not just its top.                     │
# └───────────────────────────────────────────────────────────────────────────────────────────────┘
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


---

## SUPERSEDED-BY-94da4a69 — dated correction, 2026-10-08 (coordinator, round 42)

**New authoritative baseline tip: `94da4a69`** (master, porcelain 0). One capture, sequential, `CI=true`, private
`XDG_CACHE_HOME`, `.tmp-fault` cleared, **nine roots named**: contracts domain legacy remote runtime storage testkit
tools client.

| | 2162f6a7 (original) | **94da4a69 (this correction)** |
| --- | --- | --- |
| files | 500 → re-confirmed 505 | **506** |
| registered legs | 6262 → 6288 | **6335** |
| titled reds | 19 | **10** |
| collection-error files | 3 | **0** |

**Provenance of the capture, stated exactly:** it ran on a coordinator test-merge commit whose **tree OID equals
`94da4a69`'s tree OID byte for byte** (`885632a36ae34c4b…`), so the census is a census of this master, and the equality
— not a re-run — is what transfers it. Re-run it if you doubt the transfer; it costs four minutes and a quiet machine.

**Machine-readable identity set: `nine-root-94da4a69.ids.txt` in this directory (10 lines).** It is published as a
first-class artifact on purpose: until now the list a referee actually diffs against lived in
`dev/agent-workflow/evidence/a4-pr7/7-6-closure/scratch/`, so the *document* was reproducible but the *comparison*
was not. The authoritative reference must not be a scratch file (backlog 20).

**6335 is derived three independent ways that agree**, which is the only reason the number is trusted:
`6288 + 11 (#202 guard spec) + 3 (#204 emitter pins) + 33 (#205 unmasked + M1)`;
`6291 + 33 + 11`; `6321 + 11 + 3`.

**12 identities retired since 2162f6a7 — and the load discipline still holds.** The titled-red COUNT moves with load;
compare IDENTITY SETS, never totals.

- 3 collection-error files (`p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports`): repaired,
  **32 legs register and run**. Leaving "3 collection files" published teaches every future referee to read a resolved
  collection error as expected — that sentence is the collection lane's and it is correct.
- 9 `t1-capability-schema` legs: repaired. **Note what this retires**: 5 of them had been *green* on a fixture YAML
  syntax error, so retiring them is not "9 reds fixed", it is **9 obligations that had no working assertion becoming
  9 obligations with one** (5 rewritten as identity assertions, 4 made reachable). An identity moving from red to
  green can hide a truth nobody wanted to say out loud.

**The surviving 10 are EXACTLY the classified ledger minus the retired rows** — 9 `REGISTERED-DEBT`
(1 × `t2-blueprint-hash` explicit null, 5 × `p6t3-mediation`, 2 × `p6t3-restart`, 1 × `p6t6-actions` worker→leader)
plus 1 `MUST-NOT-STAY-EXEMPT` (`D3-4`, whose only check is unreachable at `:452`). The classification and the
measurement now agree without manual reconciliation, which is the point of keeping both.

**Reproduce:**

```bash
export CI=true XDG_CACHE_HOME=<workspace>/.tmp-xdg/cache
rm -rf packages/testkit/test/.tmp-fault        # stale fault state inflates counts
npx vitest run --reporter=json --outputFile.json=/tmp/c.json   # ONE capture, nine roots, nothing else running
node scripts/fail-set.mjs capture /tmp/c.json --out /tmp/c.ids.txt
node scripts/fail-set.mjs diff \
  dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-94da4a69.ids.txt /tmp/c.ids.txt
```

**Open observation attached to this baseline (not an exemption):** `t12a-b2-child-identity` failed at FILE level with
0 legs registered once in 7 coordinator attempts on this tree; 6/6 quiet re-samples and 1/1 under 28 CPU burners were
green. Mechanism unidentified, not labelled a flake, not exempted — see backlog 20. A capture that shows it as a
collection error is a NEW red under this baseline, by design.
