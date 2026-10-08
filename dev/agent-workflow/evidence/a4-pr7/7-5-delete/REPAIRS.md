# REPAIRS — A4-PR7 §7.5 bullet 2 (every retarget, with its measured basis)

Nothing here changes a PRODUCTION control flow; each repair re-expresses an
existing law at its successor owner, using the identity the mutant census
OBSERVED (not an assumed one). Where a repair had to pick between "the old
identity kept by weakening the world" and "the measured new identity", every
repair took the measured one and kept the leg's own invariant (zero write /
non-leak / ordering) intact.

Evidence keys: `census-mutant.json` = mutant nine-root census identities;
`entry-measure-mutant.txt` = construction-level drives of the 7 entry legs on
the mutant (each: pre-count, drive, post-count → zero commit in all shapes);
targeted green runs = `transcripts/targeted-1.txt`, `transcripts/targeted-2.txt`,
`transcripts/targeted-3.txt`.

## 1. Pure code-identity swaps (census-observed, one-line-class)

`packages/runtime/test/a3p3-permission-mutation-authority.test.ts` — 9 sites
(lines 363, 401, 422, 457, 474, 497, 608, 803, 812 at the old blob):
`EXPANSION_OUTSIDE_ENVELOPE` → `AUTHORITY_CEILING_INSUFFICIENT`. Verified each
site belongs to one of the 7 red legs of that file before swapping
(python pass over the leg boundaries). Header bullet annotated: coverage is the
v3 ceiling's question now; the refusal identity is the ceiling's. `world()`
comment: the gate is ONE law now; EMPTY-envelope tightening legs refuse AT THE
GATE as no-authority, and the tightening half still commits (that half stayed
green and was not touched).

`packages/runtime/test/a3p3-revoke-reveal-semantics.test.ts` — 14 sites
(S1, S3, S7, B2c, S6, S6c, S6d, e, f, all-or-nothing, X1p, X2p, X3p, X4): same
swap, each census-confirmed as a CEIL swap. Unused `PERMISSION_EFFECT_PRECEDENCE`
import dropped. Expect count 59 → 59.

## 2. Lane-B rewrite (unit pins of the deleted mechanism itself)

Same file, `describe 'A4-PR2 lane B…'`:

* leg "a REVEAL … is a rise the classifier reports, not a no-op": kept the
  REVEAL semantics; the coverage half became (a) both envelope shapes
  `not.toThrow()` (the pure step has no authority answer any more) and (b)
  `classifyPermissionRise(cannotAsk).rising.length === 1` — the rise FACT the
  ceiling will price. Expect count preserved.
* leg "the extracted classifier and the Leader judgement never disagree":
  the injected-judge closure is deleted with the mechanism; the leg now runs a
  6-case matrix proving CONTEXT-refusal ⟺ `undeterminable` non-empty (the only
  disagreement surface that survives a pure classifier). Title kept. Expect
  count preserved.
* LAST leg retitled (§C.2 of leg-bill) to "an undeterminable region still beats
  a reported rise (the refusal order is data, not luck)" — asserts
  `rising.length===1` + `undeterminable.length===1` + the CONTEXT code + the
  `problem: effect-context-unavailable` message suffix, i.e. the ordering fact
  restated against the pure step.
* `world()` mirror comment now says the ceiling decides the declared zero
  (the world mirrors the carrier deliberately).

## 3. Width-pin file (it became the sole owner)

`packages/runtime/test/a4p7-carrier-width-under-ceiling.test.ts`:

* describe retitled (§C.1); leg-1 assertions now pin the ceiling identity:
  code `'PERMISSION_AUTHORITY_CEILING_INSUFFICIENT'`,
  `details.problem==='authority-ceiling-insufficient'`,
  `toMatchObject({plane:'expansion', ceiling:'no-authority',
  region:'exact:'+FILE})`, zero write. The 4 original expects map 1:1.
* leg 3's quote-block comment rewritten: "This file is that flip, and the
  deletion landed on top of it" (was: pending-deletion guard language).
* header bullets: the Alpha.3 width law is DELETED — this file's legs are the
  tripwire HISTORY; the ceiling law is the SOLE width owner.
* Counterfactual: FINDINGS §5 mutant 1 reddens legs 1, 3, 4 — the file bites.

## 4. No-context refusal pin + port-assembly pin

`a4p7-ceiling-no-context-refusal.test.ts` leg 9 (measured CTX swap): retitled
(§C.5); asserts `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE`,
`details.problem==='authority-ceiling-document-unavailable'`,
`details.authorityCeilingCode` DEFINED (the inner domain code rides along — the
attribution the leg has always owned), zero write. 47 → 48 expects.

`a4p7-ceiling-port-assembly-pin.test.ts` PIN-5 (measured CTX swap): retitled
(§C.6). World D's zero now speaks the UNREADABLE-DOCUMENT law. Because (b) and
(c) now SHARE the CONTEXT code, the leg's pairwise-distinctness claim was
re-expressed at the FINER grain that actually carries the remedy:
`noFs.problem('authority-ceiling-document-unavailable') ≠
rootDirect.problem('authority-ceiling-port-absent')`, plus the original
code-level distinctness of (a)↔(c) and reason-level (a)↔(c). 31 → 33 expects.
PIN-3's "told apart… by the code: three" sentence corrected (the sharing is now
by design) — PIN-3's assertions were already true. World-D construction comment
retitled to the document law. Solo-verified: predicted problem label confirmed
exactly (`targeted-1.txt`).

## 5. Root-assembled entry legs (construction-measured first, retargeted second)

`a3p4-pr4-production-entry-regression.test.ts`:

* E1 NEGATIVE (§24): retitled (§C.4); asserts the MEASURED `TEAM_RUNTIME_CALLER_NOT_FOUND`
  (ask mint faults at `packages/runtime/admission/resolve.ts:260`, before any
  case row — no orphan) + keeps the original zero-write assertion + adds an
  explicit `not.toBe(EXPANSION_OUTSIDE_ENVELOPE)`. 87→89 (shared with next).
* R4-exec / R4-ceiling / R4-absent / R4-anchor (§25–28): the
  `toContain('EXPANSION_DENIED')` expects replaced by
  `toContain('mutation-proposal-pending')` on the CLOSED PROJECTION reason
  (approval-wired lanes convert DECIDED-insufficient into a durable ask,
  A4-PR5), each with a pointer comment to the code-level pins. The legs' own
  `changed.not.toBe(true)` and post-state checks were already there and stayed.
  The legal-commits halves of these legs (tightening, in-carrier grant) were
  green before and after and untouched.
* R4-recover (§29): CTX swap; comment rewritten (during the fault both reads
  abstain and the FIRST gate that can see them is the ceiling gate); asserts
  CONTEXT + `reason` contains `could not be read`; recovery half untouched.
* R5-ws (§30): `TEAM_RUNTIME_CALLER_NOT_FOUND` swap with the non-leak framing
  kept intact (the leg's real claim is "row-A tail never became Team B's
  basis"; that assertion chain is unchanged).
* `hardYamlCeil` helper comment: the isolation argument restated for the
  ceiling-value world.

`a3p4-pr7-entry-exec-contract-regression.test.ts` R8-principal (§31):
`overCeiling.error?.code` → `TEAM_RUNTIME_CALLER_NOT_FOUND` with the
"denied expansion wrote NOTHING" `after` check kept verbatim (it is the leg's
invariant); the in-ceiling commit half untouched. 90 → 90.

## 6. Round-5 direct-call legs (B2/B5) — the two honest rewrites

`a3p4-r4-authority-binding.test.ts`: the old legs called
`authorizeLeaderPermissionMutation` directly and expected it to be an authority
judge. Post-deletion that function answers authority questions with silence —
so the legs were rewritten to pin BOTH halves of the new shape:
(1) the pure step does NOT throw on those inputs (an authority refusal must
never creep back into the classifier), and
(2) the successor law — a new shared `ceilingRefusal()` helper running
classify → `authorizeCeilingBoundedPermissionRise` over
`createPermissionAuthorityCeilingJudge`, exactly the service wiring — refuses
`AUTHORITY_CEILING_INSUFFICIENT`:
* B2: carrier ask ∧ hard allow (hard declared wider: the carrier stays the only
  binding constraint) → allow-rising refused, ask-rising passes — the ladder
  subtraction law survives at its new owner. +1 expect.
* B5: declared-zero documents → the deny→allow flip is a PROVEN rise the ceiling
  prices at `no-authority`. The laundering class stays closed. +2 expects.
New imports: `classifyPermissionRise`, `authorizeCeilingBoundedPermissionRise`,
`createPermissionAuthorityCeilingJudge`, `AuthorityEnvelopeDocuments`,
`PermissionAuthorityCeilingContext`, `LeaderMutationAuthorizationInput` (the
annotation exists to stop context-typing widening; runtime behaviour untouched).

## 7. Comment/prose-only changes (no assertion moved)

`service.ts` leader block + ceiling-branch + WHY-WIDTH paragraph (past tense,
points at this evidence dir); `permission-mutation.ts` doc block
(SUPERSEDED-history pointer replacing the dangling round-5 block);
`permission-plane.ts` historical clause. These carry no expect() and are listed
so reviewers can skip them in the assertion diff.
