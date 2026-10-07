# 7.4-B1 FINDINGS — the 14-file runtime fixture migration (pre-flip half)

Lane: **B1** · branch `feat/a4-74-b1-fixtures` · worktree `.worktrees/a4-74-b1`
Base: master `a2059c73` → rebased onto fence-round-3 + follow-up (rebased at `5ea79126`;
master has since advanced to `0d4d3c56` via the 7.6 skip-fails lane — that window is
DISJOINT from every B1 path, ancestry verified, so the branch fast-merges).
Final head at this writing: `3e9f5d20` (7 commits: 6 migration groups + ratchet release).

## 1. Per-file dispositions (before → after, scan-verified)

Before = `scratch/b1/scan-before.txt` (base `a2059c73`): `dirty(120 files, 259 sites)
unknown(16,24) advisory(12,18) refused(52,115) prose(5,5)`, exit 1.
After = head (`scratch/b1/scan-after-witness.txt`): `dirty(107,234) unknown(0,0)
adjudicated(16,24) advisory(12,16) refused(52,115) prose(5,5)`, exit 1.
(The unknown→adjudicated migration is the fence's own ledger landing, not B1 work.
advisory −2 = the two cutover `v99` `toMatchObject` advisories retired when the probes
became constant reads.)

| file (packages/runtime/test/) | before OFFENDING | disposition | after |
|---|---|---|---|
| bp1-dual-team-gate | L103,L146 v1 | migrate-by-hand: v3 + zero-declared envelopes | clean (8/8) |
| bp1-freeze-barrier | L59 v1 | same | clean (3/3) |
| bp1-red-glue-probe | L63 v1 | same | clean (2/2) |
| bp1-red-probe | L64 v1 | same | clean (6/6) |
| a4f1-row-version-not-document-version | L136 v1, L146 v1+v2 | migrate-by-hand: replace-needle carriers → structural stamp; later + witness ownership (§4) | clean (16/16); PROSE L9 (prose mention, pre-existing, non-gating) |
| a3p5-permission-read-wiring | L62 v1 | v3 + zero-declared envelopes | clean (12/12) |
| a3p5-permission-splice | L70 v1 | same | clean (9/9) |
| a3p4-pr4-decision-routing-regression | L89 v1 | same | clean (13/13); REFUSED L216 = sessionBindings row (non-blueprint-namespace sibling) — accepted residue, reported not reshaped |
| a3p4-production-permission-plane | L88 v1 | same | clean (7/7) |
| a3p4-pr7-entry-exec-contract-regression | L118 v1 | v3; in-doc carrier byte-preserved, `teamHardEnvelope: rules: []` added (root-direct world, gate inert) | clean (17/17) |
| a4p6-start-gate-entrances | L82 v1 | v3 + zero-declared envelopes | clean (6/6) |
| a4p7-v8-catalog-migration-state | L160 v1 | version carrier → structural rewrite; later + witness ownership (§4) | clean (21/21); ADVISORY L757 typed-code-position (non-gating, was L713 pre-shift) |
| a4p7-v3-cutover-acceptance | L246,L268,L279×2,L288×2,L316,L550,L551,L656 (v99/v1) | migrate-by-hand: probes parameterized off the domain's own sets (`VERSION_NOBODY_DEFINED = max(DEFINED)+1`, `withDeclaredVersion` local builder); later + witness ownership (§4) | OFFENDING clean (70/70); ADVISORY L489/L528/L584 v1 toMatchObject bridge survivors (were L452/L491/L547 mid-lane, L432/L471/L527 at base; non-gating) |
| **a3p4-pr4-production-entry-regression** | L118, L491, L843, L1128 v1 | **STOPPED — both readings in §3** | OFFENDING ×4 unchanged; DEFERRALS row KEPT |

13 migrated / 1 stopped. Every migration is version-stamp + (where required) zero/
mirrored envelope additions: no probe inverted, no assertion deleted, no literal promoted
where the v1 shape IS the subject.

## 2. The law that licenses zero-declared envelopes (root-direct worlds)

`root.ts:2899` threads `permissionAuthorityCeiling` into the governance lane ONLY when
injected; `service.ts`'s v3 gate is `ceilingContext !== undefined`; the only production
producer is `host.ts:2703` (hostEntry.apply → createAuthorityCeilingReader). Therefore a
world built directly with `createTeamProductionRoot` and no ceiling dep never consults the
v3 gate, and the Alpha.3 carrier law (version-agnostic, runs before the gate) reads an
absent carrier as `{rules: []}` NO_ENVELOPE — byte-identical input to a DECLARED-empty
carrier. `rules: []` on both v3 documents is thus inert-but-honest for every root-direct
world here (recorded in commit bodies `b54c366e`, `f842edcb`). Host-booted worlds are the
exception: the gate is live, and the Leader is bound by BOTH documents
(`expansionCeiling = meet(hard, carrier)`), so a hard mirror — not a zero — is what
preserves each fixture's intended permission there. `permission-plane.ts` L518 confirms
both v3 documents pass the SAME canonicalization channel (relative matchers included).

## 3. STOPPED FILE: a3p4-pr4-production-entry-regression — both readings

Four dirty sites (E1 L118, hostBlueprintSource L491, glue L843, r4 L1128); mixed worlds:
E1/E3 root-direct, E2 + the whole R4/R5 host group via `makeHostWorld` → hostEntry.apply
(ceiling gate LIVE at v3).

**Reading 1 — migrate now (mechanically feasible, provably neutral, NOT executed).**
v3 + `teamHardEnvelope` MIRRORING each carrier (header-swap of the same rules; the shared
canonicalizer makes even the R4-anchor relative-rule leg neutral per plane L518;
meet(carrier, mirror) = carrier; no-rise mutations skip the ceiling; Alpha.3 refuses the
over-ceiling grants before the gate anyway, so every typed refusal code survives). The
R5-hash golden literal (L2115 `sha256:f0148ab8…`) would be re-derived from the builder
(the leg's claim is "the exact bytes this builder emits", a tripwire — derivable under
any stamp). Costs: (a) the golden literal is on plan §7.3's OWN re-pin checklist
(plan L801: "the scan emits this set by path") — migrating now pulls that flip-owned
artifact into B1 and the flip checklist finds it pre-spent; (b) three legs state claims
that only v1 grammar can express — R4-absent "NO carrier is a legal typed absence"
(v3 makes absence a PARSE ERROR; the closest v3 shape is declared-zero, which is a
DIFFERENT claim), the carrier-free legacy-world control ("byte-identical" to
alpha.1/alpha.2 worlds), and R5-derive "(no ceiling gate; no self-widening)". Rewriting
those claims pre-flip is exactly the pre-flip inversion this lane forbids; keeping the
titles while the mechanics moved under them is the silent-promotion this phase fears.

**Reading 2 — leave dirty until the flip (EXECUTED).** The file is the Alpha.3 v1/v2
carrier-law regression suite AT the production entry point; plan §7.3's checklist already
owns its golden re-pin, and §7.5 already books "the 37 red are Alpha.3 guards left on the
unwired path" as flip work. Its DEFERRALS row stays; the wrapper stays honest: the row's
truth is that the path is still dirty, and it is.

This is the dispatch's named ambiguous-file case; both readings reported, neither
resolved silently. If the coordinator prefers Reading 1, the mechanical path is scoped
above (mirror helper + derived golden + three claim-rewrites as the flip's own edits).

## 4. Witness ownership (phase 1 of the factory order, commit `3e9f5d20`)

C-domain's measured stop (its FINDINGS §5:
`dev/agent-workflow/evidence/a4-pr7/7-4-cdom/FINDINGS.md` — fixtures.ts cannot move to v3
while three B1 files mint retired-version witnesses from its bytes) unblocked by:

- **a4f1**: `WITNESS_V1/V2/V3` named constants + file-owned byte body. THE DISTINCTION
  PRESERVED: the L3 row stamp stays `TEAM_DOMAIN_SCHEMA_VERSION` from the real storage
  factory — a different number from a different source; V2's equality with the stamp
  remains the file's deliberate collision leg; the anti-vacuity guard still re-measures
  divergence on every other row.
- **v8**: `V_RUNNABLE_V1/V_RUNNABLE_V3/V_UNDEFINED` re-homed above their mint sites
  (no new numbers — all were already derived), `witnessBody` + anchor minted at
  `V_RUNNABLE_V1` (its assertion pins the DERIVED set, not the factory era).
- **cutover**: `WITNESS_V1` + `witnessV1Source` own the W1 worlds, the unknown/fraction
  probes, the W2 stored-text row, the strong-parser probe and `anchorOnVersion`;
  documents whose SUBJECT is "the version this build RUNS" (group-A supported probe,
  W2_ANCHOR, ANCHOR_RUNNABLE) deliberately KEEP flowing through `revisionSource` — they
  must follow the factory, and the pre-side measurement shows they are unaffected by the
  factory's move anyway.

Measurement (both sides, identical mutation = the phase-2 factory shape
`schemaVersion: 3` + empty envelope documents; restore by `cp`, sha256
`0d2231eca8e3b25b…` verified OK each time):
BEFORE `scratch/b1/witness-coupling-BEFORE-rewrite.txt`: 3 files / 13 tests red
(a4f1 ×4, v8 ×1, cutover ×8). AFTER `scratch/b1/witness-coupling-AFTER-rewrite.txt`:
107/107 GREEN under the same mutation; clean-tree 107/107; scan classes byte-identical
(`dirty(107,234) advisory(12,16)`) — owned builders declare versions through template
reads, zero new sites. Wrapper advisory pin followed the line shift 547→584 (mechanical,
same class/count; earlier 571→547 was the v99-retirement shift — both moves recorded).

## 5. Notes against the standing checklists

- `7-3-flip/intentional-retired.md` (read post-rebase): 3 rows, none B1-owned (2 kit
  historical anchors + the legacy adapter axis). B1 needs NO row here: the migrated files
  retain no retired-version literals (the 3 cutover + 1 v8 ADVISORY lines are typed-code
  positions already measured as flip survivors, non-gating), and the stopped file stays
  DEFERRALS-dirty, which satisfies "may not be in neither". POSSIBLE ROW 4 (coordinator
  call, not filed by this lane): production-entry L2115's golden literal is exactly this
  file's shape — "the literal cannot be migrated without deleting what the file proves";
  if the flip adopts it, Reading 1's scoping above is the flip-window path.
- The cutover parameterization interacts with the flip cleanly: its probes derive
  (`VERSION_NOBODY_DEFINED = max(DEFINED)+1`, current from `SUPPORTED[0]`), so the flip
  commit moves the assertions WITH the set instead of breaking them — the red-first
  v1/v2-sibling arms the group-D header promises stay untouched by this lane.
- Deviations this lane made outside test bodies, all mechanical + measured: wrapper
  DEFERRALS ×13 path-deletions and the two advisory-pin line retargets (wrapper test file
  only); the p4t6 tie was not touched (no `it.skip/only/todo` anywhere in the branch diff,
  audited `git diff origin/master..HEAD | grep '^\+.*\.(only|skip|todo)\('` → empty).
- No `ENOENT … adjud-bad-empty.json` recurrence post-rebase (wrapper 58/58; p4t6 10/10).

## 6. Gate transcripts (final head `3e9f5d20`)

- scan before/after RESULT lines: §1.
- migrated specs individually: `scratch/b1/specs-individual-final.txt` (13/13 green);
  as one set: `scratch/b1/specs-set-final.txt` (13 files, 190/190).
- wrapper `a4p7-blueprint-version-clean`: 58/58 green (DEFERRALS = 13 B1 rows removed by
  path; production-entry row retained).
- `p4t6-session-event-scan`: 10/10. `pnpm -r run typecheck`: exit 0
  (`scratch/b1/typecheck-final.txt`). eslint on all touched files: clean.
- `lint-identities --diff` vs baseline `lint-identities-0237d487.txt`: 160 identity lines,
  76 distinct; new 0, resolved 0.
- root `pnpm test` (after `rm -rf packages/testkit/test/.tmp-fault/`): name-set identical
  to baseline — 9 files / 19 tests (t1-capability-schema ×9, p6t3-mediation ×5,
  p6t3-restart ×2, t2-blueprint-hash, d3-member-identity-context, p6t6-actions) +
  collection-time no-test p8s3b-result-effects, t12a-b2-child-identity,
  t12a-glue-handoff-ports; p6t1-parallel did not flake this run.
- p6t2-helpers.ts measurement (asked-for): still OFFENDING `L82=v1` + REFUSED `L256(v2)`
  sibling row — another lane's DEFERRALS path, untouched by B1.
