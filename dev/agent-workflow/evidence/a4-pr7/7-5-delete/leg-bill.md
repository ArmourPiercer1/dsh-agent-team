# LEG BILL — A4-PR7 §7.5 bullet 2 (per-name dispositions)

Authoritative red-name source: `transcripts/mutant-vs-base2-redo.diff` (NEW 36,
mutant vs base2 census on this tree). Dispositions cross-checked leg-by-leg
against the census JSON identities (`scratch/census-mutant.json`,
`scratch/census-final.json`), never against memory.

## A. Production names (the deletion's own bill)

| name | disposition | reason |
| --- | --- | --- |
| `leaderEnvelopeCoverage` | **DELETED** | the §7.5 target; Alpha.3 existential aggregate (class agreement + ladder reach + whole-matcher width). Successor: `createPermissionAuthorityCeilingJudge` × `permissionRiseClaimedPoints` (cell ∧ claimed width, meet over ALL covering rules of hard ∧ carrier). |
| `PermissionRiseCoverage` (type) | **DELETED** | existed only as the `coverage` injection shape for the aggregate. |
| `coverage` param of `classifyPermissionRise` | **DELETED** | classification is pure again: `{rising, undeterminable}`. |
| `unmet` accumulator + `expansion-region-uncovered` detail | **DELETED** | refusal text of the aggregate; zero remaining producers (grep-verified at final blob). |
| `PERMISSION_ENVELOPE_EXPANSION_DENIED` / `EXPANSION_OUTSIDE_ENVELOPE` constant | **KEPT (producer-less)** | frozen wire vocabulary: `packages/remote/src/handlers/dispatch.ts:248` still lists the code for dispatch mapping; a producer lane does not delete wire vocab. Doc now states producer-less-since-§7.5. |
| round-5 "the carrier is the WHOLE policy" comment | **DELETED** | plan names it explicitly; replaced by the §7.5 supersession pointer (evidence path in-text). |
| `PermissionRiseClassification` | **RETARGETED** (shape) | dropped the coverage slots; `{rising, undeterminable}`; doc rewritten to say the type reports FACTS for the ceiling to price. |
| `matcherCovers` | **KEPT** | still consumed by the subtree partition; comment now points at the `effectiveAuthorityCeiling` fold (undetermined→CONTEXT vs no-authority→INSUFFICIENT) instead of the deleted judge. |
| `permissionRiseClaimedPoints` | **KEPT** | the successor width law itself; counterfactual §5 of FINDINGS shows the width pins die the moment it is neutered. |
| `envelope` / `mutationRules` input fields | **KEPT** | carrier parse-validated input (MALFORMED_ENVELOPE stays an input-validation fact); field docs rewritten ("reads NO policy"). |
| `effectiveAuthorityCeiling`, `narrowingForApproval` | **KEPT, UNTOUCHED** | §7.5 bullet 1; diff against master shows zero change in `packages/domain/authority-envelope/` and `governance/authority-ceiling.ts`. |

## B. The 36 mutant reds (per-name)

Class CEIL = mutant observed `AUTHORITY_CEILING_INSUFFICIENT`; CTX = CONTEXT
document-unavailable; ENTRY = construction-measured (§1a of FINDINGS);
UNIT = dead-mechanism unit pin rewritten. Detailed before/after assertions:
`REPAIRS.md`.

| # | leg (file::name) | observed | disposition |
| --- | --- | --- | --- |
| 1 | a3p3-permission-mutation-authority::Human mutation (ADR §7) creates NO permanent priority… | CEIL | RETARGETED (code swap) |
| 2 | …::Leader mutation OUTSIDE the envelope… maxEffect ceiling is a CEILING | CEIL | RETARGETED |
| 3 | …::an expansion the envelope does not cover is refused and writes NOTHING | CEIL | RETARGETED |
| 4 | …::exact envelope rules do not cover wider matchers; subtree roots cover what they contain | CEIL | RETARGETED |
| 5 | …::TIGHTENINGS need NO expansion authority: all three, with an EMPTY envelope | CEIL | RETARGETED |
| 6 | …::a from-absence GRANT is an expansion measured from the DECLARED-NONE deny fallback | CEIL | RETARGETED |
| 7 | …::exec exactness (design §5) an exec expansion is covered ONLY by the identical fingerprint | CEIL | RETARGETED |
| 8 | a3p3-revoke-reveal::A4-PR2 lane B: the extracted rise facts are the facts Alpha.3 refused on a REVEAL… | CTX-shape unit | REWRITTEN (mechanism deleted; leg now proves `{rising,undeterminable}` shape + ceiling-priced refusal; expect count preserved) |
| 9 | a3p3-revoke-reveal::A4-PR2 lane B: … never disagree about the same input | unit | REWRITTEN (6-case CONTEXT⟺undeterminable matrix; inject-judge closure deleted; title kept; expect count preserved) |
| 10 | a3p3-revoke-reveal::(e) WIDTH-conservative: envelope covering ONE child… | CEIL | RETARGETED |
| 11 | …::(f) nested exception: ceiling ask refuses, ceiling allow passes | CEIL | RETARGETED |
| 12 | …::S6: subtree-deny removal revealing a STATIC allow… | CEIL | RETARGETED |
| 13 | …::S6c: coverage of the matcher with a too-LOW ceiling refuses | CEIL | RETARGETED |
| 14 | …::S6d: fallback-ASK region… needs ceiling-ask | CEIL | RETARGETED |
| 15 | …::all-or-nothing across mutation rules: one uncovered rising class refuses the WHOLE | CEIL | RETARGETED |
| 16 | …::S1: revoke revealing a STATIC allow refuses under an empty envelope, ZERO write | CEIL | RETARGETED |
| 17 | …::S3: deny->ASK reveal is expansion VERBATIM (ADR §6) | CEIL | RETARGETED |
| 18 | …::B2c (declared deny): over DECLARED-NONE facts the same ask grant IS a real expansion | CEIL | RETARGETED |
| 19 | …::S7: lifting a shadowing subtree deny… REMAINING overlay rule | CEIL | RETARGETED |
| 20 | …::X1p: the SAME revoke WITH the predicate… EXPANSION-coded refusal | CEIL | RETARGETED |
| 21 | …::X2p: the SAME equal-subtree deny->ask… ladder-strict | CEIL | RETARGETED |
| 22 | …::X3p: the SAME static-subtree reveal… decidable deny->allow expansion | CEIL | RETARGETED |
| 23 | …::X4 GATE SPECIFICITY: EXACT-ONLY context with NO predicate flows NORMALLY | CEIL | RETARGETED |
| 24 | a3p4-pr4::E1 NEGATIVE: an envelope region WITHOUT coverage… | ENTRY (CALLER_NOT_FOUND, zero write) | RETARGETED + RETITLED (see §C) |
| 25 | a3p4-pr4::R4-absent (§7.3) — a DECLARED-EMPTY carrier… | ENTRY (pending-proposal) | RETARGETED (reason-identity swap) |
| 26 | a3p4-pr4::R4-anchor — RELATIVE carrier rule canonicalizes at TARGET… | ENTRY (pending-proposal) | RETARGETED |
| 27 | a3p4-pr4::R4-ceiling — an ASK carrier ceiling refuses the ALLOW grant… | ENTRY (pending-proposal) | RETARGETED |
| 28 | a3p4-pr4::R4-exec — configured bash-fingerprint carrier reaches ALLOW… | ENTRY (pending-proposal; legal half still commits) | RETARGETED |
| 29 | a3p4-pr4::R4-recover — provider fault at warm-up… | CTX | RETARGETED (code CONTEXT + reason `could not be read`) |
| 30 | a3p4-pr4::R5-ws — FIX-3 CWD source-of-truth… | ENTRY (CALLER_NOT_FOUND) | RETARGETED (code swap; non-leak assertions kept) |
| 31 | a3p4-pr7::R8-principal Leader claim → NOT the §7 exemption… | ENTRY (CALLER_NOT_FOUND) | RETARGETED (error-code swap; zero-write `after` check kept) |
| 32 | a3p4-r4-authority-binding::B2 (envelope-level subtraction) | CEIL (via successor law) | REWRITTEN: pure step pinned NOT to throw; ceiling meet (hard wider, carrier ask) refuses `AUTHORITY_CEILING_INSUFFICIENT`; ask-grant still passes. +1 expect |
| 33 | a3p4-r4-authority-binding::B5 (R-A shape) laundering class | CEIL (via successor law) | REWRITTEN: pure step no-throw + declared-zero documents → `AUTHORITY_CEILING_INSUFFICIENT`. +2 expects |
| 34 | a4p7-carrier-width::a carrier that covers the rising cell but NOT the whole mutation matcher… | CEIL | RETARGETED leg-1 assertions (code/problem/plane/ceiling/region details + zero write; 4 expects kept) |
| 35 | a4p7-ceiling-no-context::9. a Leader rise Alpha.3 itself refuses… | CTX | RETARGETED + RETITLED: CONTEXT code, `problem=authority-ceiling-document-unavailable`, `authorityCeilingCode` toBeDefined, zero write. +1 expect |
| 36 | a4p7-ceiling-port-assembly-pin::PIN-5 attribution… CARRIER law | CTX | RETARGETED + RETITLED: world D now UNREADABLE-DOCUMENT law; pairwise-distinctness re-expressed at problem grain. +2 expects |

## C. Identity renames (for the lint-identities / census-set diffs)

Every rename is deliberate: the old name asserted a law the deletion moved.
Old → new, with why:

1. `a4p7-carrier-width-under-ceiling` DESCRIBE
   "…(pre-7.3 deletion guard)" → "…(sole owner since the §7.5 deletion)" —
   renames ALL 8 legs in the file; the guard's guard period is over, the file is
   now THE width owner.
2. `a3p3-revoke-reveal` "an undeterminable region still beats **an uncovered
   one** (the refusal order is data, not luck)" → "…still beats **a reported
   rise**…" — with coverage gone, the ordering fact is CONTEXT-vs-rise, not
   CONTEXT-vs-uncovered.
3. `a3p4-r4-authority-binding` DESCRIBE "authorizeLeaderPermissionMutation
   envelope-only algebra (round 5): the carrier is the WHOLE policy — the
   leader-facts ceiling gate is REMOVED (ADR §6, parent final review)" →
   "authorizeLeaderPermissionMutation post-§7.5: the pure step reports rises and
   refuses only CONTEXT — authority is the v3 ceiling's (round 5's "carrier is
   the WHOLE policy" SUPERSEDED)" — renames legs B1, B2, B4, B5. The round-5
   claim in the old name is exactly the sentence the plan orders deleted.
4. `a3p4-pr4` E1 NEGATIVE "…refuses typed EXPANSION_DENIED and writes nothing"
   → "…never commits — post-§7.5 the ceiling-refused drive dies at the
   escalation seam and writes nothing".
5. `a4p7-ceiling-no-context` leg 9 "a Leader rise Alpha.3 itself refuses keeps
   its OWN refusal identity (ordering untouched)" → "the Leader rise the deleted
   Alpha.3 law used to refuse now meets the ceiling OWN CONTEXT identity".
6. `a4p7-ceiling-port-assembly-pin` PIN-5 "…zeroes authority through the
   CARRIER law (typed EXPANSION_DENIED throw)…" → "…through the
   UNREADABLE-DOCUMENT law (typed CONTEXT throw, problem
   authority-ceiling-document-unavailable)…".

Renamed-GREEN legs (never red under the mutant, moved only by renames 1–3):
carrier-width legs 2/3/4/5/6/7/8 (7 legs), B1 and B4 (2 legs). They appear as
retire+add pairs in lint-identities; they are the same assertions, retitled.

## D. Expect-count ledger (rule 3 — per-file `grep -c 'expect('`, HEAD → final)

| file | HEAD | final | delta | where |
| --- | --- | --- | --- | --- |
| a3p3-revoke-reveal-semantics | 59 | 59 | 0 | lane-B rewrite held counts |
| a3p3-permission-mutation-authority | 82 | 82 | 0 | pure code swaps |
| a4p7-carrier-width-under-ceiling | 33 | 33 | 0 | leg1 same 4 expects |
| a4p7-ceiling-no-context-refusal | 47 | 48 | +1 | leg9 `authorityCeilingCode` toBeDefined |
| a4p7-ceiling-port-assembly-pin | 31 | 33 | +2 | PIN-5 `noFs.problem` label + pairwise problem-distinctness |
| a3p4-pr4-production-entry-regression | 87 | 89 | +2 | E1 not.toBe(EXPANSION) guard; R4-recover reason-contains |
| a3p4-pr7-entry-exec-contract-regression | 90 | 90 | 0 | error-code swap only |
| a3p4-r4-authority-binding | 59 | 62 | +3 | B2 +1 (pure-step no-throw), B5 +2 (no-throw, instanceof, code) |

Total +6, every one an added ASSERTION (no expect was ever silently dropped).
