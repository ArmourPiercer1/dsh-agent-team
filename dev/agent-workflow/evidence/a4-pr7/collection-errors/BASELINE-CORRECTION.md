# BASELINE CORRECTION — proposed, NOT applied here

Lane `fix-a4-collection-errors-32` does not edit
`dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md`: that file is the coordinator's
published baseline. Below is the block to append to it, in the same dated-correction form the file already uses
(see its "PUBLISHED CORRECTION (2026-10-08, round 38)" section), plus the two mechanical edits it implies.

---

## BLOCK TO APPEND (verbatim)

```markdown
## PUBLISHED CORRECTION (2026-10-09, lane fix-a4-collection-errors-32) — the 3 collection files are repaired:
## the universe is 6321, the failing set is 19 by identity, and the hidden 32 legs are GREEN, not red

The three collection-error files listed above (`p8s3b-result-effects`, `t12a-b2-child-identity`,
`t12a-glue-handoff-ports`) now collect. Causes, in one line each — every one is a test double that stopped
honouring a production law that moved under it; no product file changed:
`sessionPersistence.exists` (C1 public seam) and `agentPresets` (D1 v3 preset mount) were missing from the
doubles in `p8s3b-result-effects.test.ts`; the `t12a-b2` restart fixture carried the session artifact without the
durable `MemberInstance` row, and P0-1 §3.4 correctly refused the cold-member resume
(`capability-template-unresolved … reason=template-id-missing`); `t12a-glue-handoff-ports` expressed "no
effective persona" as `blueprintSource: ''`, which the §7.3 v3-only cutover refuses at `parseBlueprint`
(`blueprint document must start with a --- frontmatter delimiter line`) — it now says it with
`presetSubstrate.personaKind: 'absent'`.

Nine-root census at this tree, ONE capture, roots named `contracts domain legacy remote runtime storage testkit
tools client`: **505 files / 6321 registered legs / 19 titled reds / 0 collection-error files**
(150+523+100+232+4046+287+372+129+482 = 6321; per-root detail in
`dev/agent-workflow/evidence/a4-pr7/collection-errors/scratch/tip-census.roots.txt`).

`node scripts/fail-set.mjs diff 7-6-closure/scratch/baseline-2162f6a7.ids.txt <this capture>`:
**baseline=22 current=19 NEW=0 FIXED=3**, and the 19 `TEST` identities are the set listed above VERBATIM. The
three `FIXED` lines are exactly the `FILE …::COLLECTION-OR-UNHANDLED` identities.

Two readings of this correction the file must not lose:

* **+33 legs, and the arithmetic is the claim**: 6288 → 6321 = the 32 previously-hidden legs plus one new leg
  (`M1`) that exists to discharge plan §7.2 line 791. The three files registered **zero** legs before, so no
  other file's identity set can have moved — the diff proves it.
* **The estimate "≈19 of the 32 would be red" (baseline-classes §6.2) was wrong: 0 are.** The 32 came back
  green. That is NOT evidence the suite is comfortable — a re-appearing leg that bites nothing is the same blind
  spot in a different coat. Six mutation witnesses in
  `dev/agent-workflow/evidence/a4-pr7/collection-errors/transcripts/probe-*.txt` show each plane biting
  (G2 / G3-G8 / B2-2 / B2-3 / GLUE-11 / E3-E4-E6-E7). The residual instrument hole is named in that lane's
  FINDINGS §3.1: no leg covers the mapping→carrier composition, so a mapping regression never reaches the
  carrier legs.

Operational consequence: **the "collection-error files" section below is now empty. Do not leave a stale entry
in it.** A file that never registers contributes no identity, so a baseline that still lists these three
teaches every future referee to read a resolved collection error as "as expected".
```

---

## MECHANICAL EDITS THE COORDINATOR MAKES (this lane touched neither file)

1. **Header line** of `nine-root-2162f6a7.md` — from
   `# files 500 | registered legs 6262 | titled reds 19 | collection-error files 3`
   (already superseded in prose by `505 / 6285 / 19 / 3` at `ac54ffb8` and by `505 / 6288 / 19 / 3` on current
   master) to the capture above: `# files 505 | registered legs 6321 | titled reds 19 | collection-error files 0`,
   with the tree moved to this lane's tip.
2. **The `## collection-error files` section** (currently three lines) becomes empty, with a pointer to
   `dev/agent-workflow/evidence/a4-pr7/collection-errors/FINDINGS.md` for why.

## THE 19-IDENTITY FAILING SET, READY TO PUBLISH

Machine-readable replacement for `7-6-closure/scratch/baseline-2162f6a7.ids.txt` (22 lines → 19):
`scratch/tip-census.ids.txt` in this evidence dir — same identity grammar, same normalizer, captured through
`node scripts/fail-set.mjs capture raw/tip-census.json`.

The full **registered-leg** identity set (6321 lines, `TEST <path>::<full name>`, the artifact a future "did a
leg disappear?" question actually needs) is `scratch/tip-census.legs.txt`, produced by `scratch/leg-set.mjs`.
