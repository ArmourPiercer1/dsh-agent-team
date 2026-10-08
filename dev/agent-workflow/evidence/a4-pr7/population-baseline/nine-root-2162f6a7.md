# POPULATION BASELINE — NINE-ROOT SCOPE (authoritative from 2026-10-08)
# ┌─ READ THIS FIRST ─────────────────────────────────────────────────────────────────────────────┐
# │ THIS BASELINE WAS RE-MEASURED AT b9cc0a2d (branch fix/a4-d3-4-rejection-test). ITS FIGURES ARE │
# │ IN "CURRENT CORPUS" AT THE END OF THIS FILE: 507 files / 6355 registered legs / 9 titled reds  │
# │ / 0 collection-error files. The tolerated identity set IS the "titled reds" section below;     │
# │ machine-readable copies in nine-root-post-d3-4-split.ids.txt (its 10-line predecessor:         │
# │ nine-root-94da4a69.ids.txt). The numbers in the header below are the 2162f6a7 capture, kept as │
# │ history — but a referee that reads only the header will treat a RESOLVED collection error as   │
# │ expected, which is how 32 legs stayed invisible for a whole stage. Read the end of the file.   │
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
# CURRENT AT b9cc0a2d (restated 2026-10-09, lane fix/a4-d3-4-rejection-test). THIS SECTION IS A MACHINE INTERFACE, NOT PROSE.
# scripts/ci-pr-gate.mjs parses the lines below into the set of TOLERATED red identities. A line here
# means: this red is known, and a fresh run may not blame it on the change under review. It does NOT
# mean the obligation is met -- every one of these 9 lines is disclosed debt with a named green pin.
# Twelve lines were removed when #204/#205 retired them and a thirteenth when the last
# must-not-stay-exempt (D3-4) was repaired instead of carried; a regression of any retired identity
# arrives as NEW RED and blocks the merge. The 19 earlier entries are in historical-2162f6a7.ids.txt
# (an artifact, because prose OUTSIDE this section is mined for family names and retired paths must
# not become tolerances). A '#' line inside this section is read by neither parser, which is why the
# exact strings of the identity that left the list, and of its two green successors, are recorded
# HERE and nowhere else:
#   RETIRED (repaired, not carried): TEST packages/runtime/test/d3-member-identity-context.test.ts::D3 the member identity context block (Team D1-D6 repair v2, B2) D3-4 FAIL CLOSED: wrong/missing rootSessionId stays rejected at the closed tool layer; a foreign-root setup rejects without installing a block
#   SUCCESSOR 1 (the half this leg kept, GREEN): TEST packages/runtime/test/d3-member-identity-context.test.ts::D3 the member identity context block (Team D1-D6 repair v2, B2) D3-4 FAIL CLOSED: wrong/missing rootSessionId stays rejected at the closed tool layer (never status executed)
#   SUCCESSOR 2 (the half split out so it can run, GREEN): TEST packages/runtime/test/d3-member-identity-context.test.ts::D3 the member identity context block (Team D1-D6 repair v2, B2) D3-4b FAIL CLOSED (the setup-level half of D3-4, split out to execute): a committed member bound under a FOREIGN root rejects with the typed capability-template-unresolved error and installs no block, registers no tool
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
# NONE at 02b53c7a -- all three repaired by PR #205 and their 32 legs register and run. The rule
# survives the emptiness: a titled red that resolves INTO a collection error is an escalation, never an
# improvement, because a file that dies at collection contributes no identity to either set -- which is
# precisely how 32 legs stayed invisible for a whole stage while the red count went down.

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
---

## REPAIRED, NOT CARRIED — the last must-not-stay-exempt, 2026-10-09 (lane `fix/a4-d3-4-rejection-test`)

External review item **D3-4** named the one line in the 10-line list that could not be believed in
either direction: the leg was red, and the thing it was red about was a probe reading the *wording* of
an error (`expect(setupError.message).toContain('fail closed')`) — while the assertion AFTER it,
`expect(foreignCtxPersonaEntries.length).toBe(0)`, which is the actual claim ("a bind under a root that
does not own the member installs no identity block"), had never executed since the leg went red. The
exemption therefore excused a leg that proved nothing: not the claim, and not its absence. Full
strings — retired identity and both successors — are in the `#` block inside the titled-reds section
above, which is the only place in this document that carries them (prose outside the identity sections
is mined for disclosures, so pasting an identity string there would grant a file an exemption).

**What the split did.** No product file changed (CORE PATCH BUDGET held at 0 — the claim was never
unsupported). The world and the probe call are unchanged; the leg was cut in two at the semicolon its
title already contained. The tool-layer half keeps its assertions verbatim and its title is reduced to
what it still asserts; the setup-level half becomes its own leg and now leads with the reads the message
probe was blocking: the typed rejection (`code: 'capability-template-unresolved'`,
`reason: 'template-id-missing'`, the refused instance, and the message naming the session it refused)
and the absence of effects — no scoped persona section of any kind, no registered tool, and the boot
member's legitimately-installed block still naming its own root. A positive control (the second root's
member: one successful setup, exactly one block, the team tools registered) keeps the three zero-reads
from being satisfiable by a context nobody ever set up.

**Why the prose probe was wrong, not merely stale.** The probe is the real cold-member bind — the
argument shape the production cold path uses, through the glue's exported setup factory over the live
world, not an internal shortcut. Under a foreign root there is no member row for that child session and
the fresh-create hint is deliberately not an authorization fallback for a cold bind (P0-1 hardening
§3.4), so the refusal comes from the capability locate, BEFORE the persona layer whose sentence the old
assertion quoted. The typed error is the contract; the message substring was a proxy for a boundary
that PR-class work had already moved — the same drift the leg's own comment records for the tool layer
(caller-root gate, PR #20).

**Mutation control (the new leg was proven to bite, not merely to pass).** The product was temporarily
made to FAIL OPEN at both sites of the same law — a boot-root fallback standing in for the foreign
root's missing row, once in the capability locate and once in the persona install, installing the block
UNDER THE FOREIGN ROOT. The new leg went red on every claim: the typed rejection (no error at all), and
— the point of the exercise — the previously-masked reads: `expected 1 to be +0` for the persona
entries, `expected [ 'deployment:persona' ] to deeply equal []`, and 15 registered tools on a context
that must carry none; the boot member's own installed block was disposed by the hijack too. Product
file restored with `git checkout --` (0 mutation markers, `git status` clean for `packages/`) and the
file re-run green. Transcripts: `dev/agent-workflow/evidence/a4-pr7/d3-4-rejection/transcripts/`
(`02` the mutation patch, `03` red, `04` every read red under soft assertions, `05` green after
restore).

**The identity set moved one way, and only that way.** ONE capture, sequential, `CI=true`, private
`XDG_CACHE_HOME`, `.tmp-fault` cleared, nine roots named, machine quiet (load 1.79 on 32 cores, nothing
else running): 507 files holding 6355 registered legs, 9 failing identities, 0 collection-error files.
`node scripts/fail-set.mjs diff` against `nine-root-94da4a69.ids.txt` → **baseline=10 current=9 NEW=0
FIXED=1**, exit 0. The removed line is the retired identity above; the +1 leg is the split-out leg, and
it is GREEN, so it is not a tolerance. Machine-readable post-repair set: **`nine-root-post-d3-4-split.ids.txt`**
in this directory (9 lines). No tolerance was added anywhere in this change, and no fixture expectation
was edited to match live output — the exemption list shrank by exactly one line and the totals line
below was re-measured, not re-narrated.

**Reproduce:**

```bash
export CI=true XDG_CACHE_HOME=<workspace>/.tmp-xdg/cache
rm -rf packages/testkit/test/.tmp-fault
pnpm exec vitest run --reporter=default --reporter=json --outputFile.json=<scratch>/census.json
node scripts/fail-set.mjs capture <scratch>/census.json --out <scratch>/census.ids.txt
node scripts/fail-set.mjs diff \
  dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-post-d3-4-split.ids.txt \
  <scratch>/census.ids.txt
```

---

## CURRENT CORPUS (the sentence scripts/ci-pr-gate.mjs reads for its totals)

At `b9cc0a2d`: 507 files / 6355 registered legs, 9 titled reds, 0 collection-error files, nine roots
named (contracts domain legacy remote runtime storage testkit tools client).

Why the figures are written in this grammar and not in a table: `lastDeclaredTotals()` matches
`N files / M legs` or `files N | registered legs M`, taking the occurrence with the highest character
offset across both shapes. A markdown table of the same numbers is INVISIBLE to it, which is how this
document came to declare 505 / 6285 while displaying 506 / 6335 -- the gate printed `COUNTS MOVED` on
every run and nothing failed, because a moved count is informational by design. **A document a machine
parses is an interface: what you add to it changes the gate, so re-measure the parse instead of
trusting the prose.** The shape after this restatement is asserted by
`node scripts/ci-pr-gate.mjs --self-test`.

**Provenance, stated so the next reader need not re-run everything to trust the numbers above:** the
capture was taken on a merge commit whose `packages/` tree OID is
`6c652989e35d70da286f87f6e36276b4d20760b8`, and `master` at `02b53c7a` has the **same** `packages/` tree
OID (zero differing files). The graded surface is exactly the nine roots under `packages/`, so the
measurement **transfers by tree equality** rather than by assertion — which is a checkable claim, unlike
"the same code, roughly".

**Provenance of the `b9cc0a2d` restatement above, same discipline:** that capture graded a `packages/`
tree whose OID is `fef63f0651b71b62db92f717202392c1d7aeca00`, and `git diff --name-only` between it and
the `6c652989e35d70da286f87f6e36276b4d20760b8` tree above names **exactly one file** — the D3
member-identity suite this lane split. So the whole distance between the two figures is one changed test
file plus the one leg it added, and the capture says so independently: the identity diff came back
NEW 0, which is the set-theoretic way of saying "nothing else in the other 506 files moved". The commit
that carries this document changes nothing under `packages/` at all, so this measurement transfers to
it by the same tree equality (verify: `git diff --name-only b9cc0a2d HEAD -- packages/` is empty).

**Two figures here are load-sensitive and are disclosed instead of smoothed.** Two legs — one in a
governance-hygiene suite, one in an evidence-sanitizer suite — run bimodally around the suite's own
5000 ms `testTimeout` and were observed failing at 5.26 s and 5.86 s in 3 of 4 default-clock captures
this round, while the same captures under the 20000 ms clock the workflow passes came back with an
identical set and zero such failures. The repair is to give those legs a declared budget in the suite
(backlog 16), **not** to add their names to the tolerance list above: an exemption granted because a leg
is slow excuses every genuine red that leg will ever produce. Until then a run that fails them under the
default clock is reporting something true, and the honest response is the budget fix, not a `skip`.
