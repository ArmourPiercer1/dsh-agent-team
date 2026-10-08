# A4-PR7 §7.5 bullet 2 — DELETION OF `leaderEnvelopeCoverage`: FINDINGS

Branch `feat/a4-75-delete` (base master `2f06bb44`). Single writer: task-7 lane.
Evidence root: `dev/agent-workflow/evidence/a4-pr7/7-5-delete/`.

## 1. THE VERDICT FIRST: the deletion is SAFE, and it was MEASURED, not argued

**Mutant experiment at the CURRENT base (round-23's experiment re-run, not
inherited):** with `leaderEnvelopeCoverage` neutered (patch
`scratch/mutant-on-current-base.patch`, blob `ddf28274…` ≠ base `b2e42ce1…`,
verified by `git hash-object` at every step), the nine-root census produced
**NEW = 36** red legs (`transcripts/mutant-vs-base2-redo.diff`, authoritative
name list; base2 census `scratch/census-base2.json` captured on this very tree
before any edit, so the mutant diff has no stale-base residue). Round 23 counted
38 at `991348e0`; the delta to 36 is the legs that §7.3 prerequisites (1)–(3)
already moved onto the ceiling — both numbers say the same thing: the deletion
refuses **nothing new**. Every one of the 36 was dispositioned (§2), and the two
hard stops behaved as follows:

* **Hard stop (a) — drive refuses-before/commits-after: DID NOT FIRE.** All
  seven entry-level red legs were re-driven construction-level against the
  mutant (`transcripts/entry-measure-mutant.txt`): every drive that base refused
  terminates post-mutant in one of three ZERO-WRITE shapes — (i) a typed ceiling
  or CONTEXT throw, (ii) `mutation-proposal-pending` with `{changed:false}` plus
  a durable approval ask (approval-wired lanes with a team-root binding), or
  (iii) a mint fault `TEAM_RUNTIME_CALLER_NOT_FOUND` raised at admission BEFORE
  any case or row exists (approval-wired worlds without a binding, E1 / R5-ws /
  R8 worlds). In all shapes the overlay rule count after the drive equals the
  count before it: **zero commits, zero new durable rows**.
* **Hard stop (b) — shipped behaviour newly refusing anything: 0 observed.**
  The only post-deletion refusal *additions* are `authority-ceiling-insufficient`
  and its CONTEXT sibling where the deleted aggregate used to be the first
  speaker — the same drives, the same fail-closed direction, a different
  (successor-law) identity. The census confirms no previously-green leg turns
  red on the shipped (non-mutant) tree: final nine-root census NEW = 0 vs the
  population baseline (`FINAL-BATTERY.txt`).

**The danger this task was told to hunt is a WIDENING, and the measurement
found none.** The plan's own mechanism worry — whole-matcher width (the field
`region.mutationMatcher` had exactly one reader: the aggregate) — was closed
*before* this lane by prerequisite (1): `permissionRiseClaimedPoints` prices the
ceiling at the cell AND the claimed width, so `ceiling-pass ⇒ coverage-pass`
algebraically: any rise the deleted existential judge would have passed has a
covering carrier rule of class agreement and ladder reach at the WHOLE matcher,
and the ceiling meet at that same matcher already demands `maximumEffect ≥ risen
effect` at it. The counterfactual still bites: reverting the claimed-point set to
cell-only reddens exactly the three width legs named in §5.

## 2. Disposition of the mutant's 36 (all names: `transcripts/mutant-vs-base2-redo.diff`)

| class | n | what the mutant did to them | disposition |
| --- | --- | --- | --- |
| Ceiling-swap refusals | 31 | `EXPANSION_OUTSIDE_ENVELOPE` → `AUTHORITY_CEILING_INSUFFICIENT` at the same point | RETARGETED code expectation (census-confirmed, no construction change) |
| CONTEXT-swap refusals | 3 | refusal becomes CONTEXT (`authority-ceiling-document-unavailable`) — R4-recover, no-context leg 9, PIN-5 | RETARGETED code+problem expectation |
| Dead-mechanism unit pins | 2 | lane-B legs that injected the coverage judge itself — mechanism deleted | REWRITTEN against the successor law (REVEAL + never-disagree legs) |
| Entry-level legs | 7 | refusal shape moved (pending-proposal / CALLER_NOT_FOUND / CONTEXT) | construction-measured zero-write (§1a), RETARGETED with the measured identity |

Per-name ledger: `leg-bill.md`. Repair-by-repair justification: `REPAIRS.md`.

## 3. What was deleted (the bullet-2 bill, production)

`packages/runtime/governance/permission-mutation.ts`:

* `leaderEnvelopeCoverage` — the whole function (existential class-agreement +
  ladder-reach + whole-matcher width judge) — **DELETED**;
* its injection `coverage` param into `classifyPermissionRise` and the
  `unmet`/coverage block — **DELETED** (`classifyPermissionRise(input)` now
  returns `{rising, undeterminable}` only);
* the refusal text `EXPANSION_OUTSIDE_ENVELOPE` + `expansion-region-uncovered`
  + CONTEXT `subtree-containment`-from-coverage — **GONE as a producer**; the
  CODE CONSTANT is **KEPT** (frozen wire vocabulary:
  `packages/remote/src/handlers/dispatch.ts:248` still lists
  `PERMISSION_ENVELOPE_EXPANSION_DENIED`; a wire vocab member cannot be deleted
  by a producer lane — it is now documented producer-less);
* the round-5 "the carrier is the WHOLE policy" comment — **DELETED**, replaced
  by the §7.5 supersession note pointing at this evidence dir;
* `PermissionRiseCoverage` type, `envelope`/`mutationRules` reader-semantics
  rewritten ("parse-validated carrier… reads NO policy");
* KEPT, with corrected docs: `matcherCovers` (partition still consumes it; its
  comment now points at the `effectiveAuthorityCeiling` fold and the
  undetermined-vs-no-authority split), `permissionRiseClaimedPoints` (:1194, the
  width law itself — the counterfactual in §5 proves it is load-bearing), the
  `envelope` FIELD (carrier input validation: MALFORMED_ENVELOPE parse at the
  service stays).

`packages/runtime/governance/service.ts`: leader-block comment rewritten
(A4-PR7 §7.5 supersedes round 5); the ceiling gate below prices BOTH documents
via `ceilingContext` — the carrier reaches the ceiling as a BOUND DOCUMENT, not
as a second judge. No control-flow change.

`packages/runtime/src/plugin/permission-plane.ts`: the historical clause
retitled ("ever spoke where the carrier FAILED to cover") — the prose that made
X5 stay green without the aggregate is now stated as the reason the deletion is
neutral, not as a guard.

## 4. Post-deletion refusal-identity map (measured, four worlds)

| world | base identity | post-deletion identity | durable delta |
| --- | --- | --- | --- |
| leader lane, ceiling port wired | `AUTHORITY_CEILING_INSUFFICIENT` behind the aggregate | `AUTHORITY_CEILING_INSUFFICIENT` (same code, now first speaker) | none |
| leader lane, port absent | CONTEXT `authority-ceiling-port-absent` (after aggregate refused first) | CONTEXT `authority-ceiling-port-absent` (unchanged identity) | none |
| approval-wired + team-root binding, insufficient | terminal refusal | `{changed:false, reason:'mutation-proposal-pending', approvalCaseId, requiredAuthority, detail.problem:'rise-above-actor-authority'}` | **NEW durable ask** where base died terminal — the DESIGNED A4-PR5 escalation, now reaching the carrier axis; ask-only, zero commit |
| approval-wired, NO binding (E1/R5-ws/R8 worlds) | terminal refusal | ask mint throws `TEAM_RUNTIME_CALLER_NOT_FOUND` at admission (`packages/runtime/admission/resolve.ts:260`, before case creation) | none observable beyond code label: no orphan rows, no overlay write (`runApprovalAsk` writes proposal rows only on `legOutcome.kind==='leg'`) |

Disclosure kept loud: row 3 is the deletion's only real behavioural extension —
leader drives that base terminated can now open a human ask. That is strictly
toward more authority friction (a durable approval case a human must resolve),
and it is the same law operator mutations already ride since A4-PR5.

## 5. Counterfactual bites (rule 2: a pin that cannot fail is not a pin)

* **Mutant 1** — `permissionRiseClaimedPoints` → cell-only (width point
  removed). Reds, named (`transcripts/counterfactual-1-width-only.txt`):
  `a4p7-carrier-width-under-ceiling` legs 1 ("a carrier that covers the rising
  cell but NOT the whole mutation matcher refuses the wider mutation, zero
  write"), 3 ("the ceiling is asked at the WIDTH the mutation claims…"), 4 ("at
  the real entry, with NO Alpha.3 Leader law in the way, the width refusal
  commits nothing"). 50 others green — the bite is exactly the width law.
* **Mutant 2** — port-absent fail-closed branch (`service.ts:1216`) neutered.
  Reds, named (`transcripts/counterfactual-2-port-absent.txt`):
  `a4p7-ceiling-port-assembly-pin` PIN-3 (the inverted root-seam pin) and PIN-5.
  16 others green.
Both mutants were throwaway, restored by `git checkout`, blob hashes re-verified
(rule 4): governance tree after restore == staged final state (`git diff` 0).

## 6. Flake discipline / disclosure

The p6t1-parallel pair is red under census load and 3/3 green SOLO at the
baseline (documented load-flake family; red in `census-base2.json` too, i.e.
present before any edit). Published dirty, disclosed, not "fixed". Any NEW in
the final census outside that family gets a solo run before anything else is
interpreted (`FINAL-BATTERY.txt`).

## 7. X5, the case the deletion could NOT have widened

The X5 shape (subtree envelope matcher with no containment predicate) survives
the deletion GREEN without ever consulting the deleted judge: domain
`effectiveAuthorityCeiling` → `evaluateMatches` → `undetermined` (unknown
subtree relation) → UNDETERMINED verdict → CONTEXT. The post-deletion refusal
identity is the same CONTEXT identity the deleted X5 push used to produce —
the successor law already spoke this case, which is the concrete shape of "the
deletion removes a refusal IDENTITY, not a hole" (plan 勘误, clause (3)).
