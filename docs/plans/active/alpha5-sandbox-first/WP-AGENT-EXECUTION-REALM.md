# WP — Agent Execution Realm (next phase; design only)

**Status:** **DESIGN ONLY — not implemented, not funded, not scheduled by a release decision.**
This document changes no product behaviour, no blueprint, no test and no candidate. Reading it does
not imply any current guarantee changed.
**Written:** 2026-11-11 by the DOCS lane, from audit C's ownership finding and the closeout
baseline.
**Depends on:** the outcome of **PD-42 / P0-1** (see `V016-PREVIEW-CLOSEOUT-PLAN.md` step A1) and
of PD-41's dispatch semantics. It must not start before A1 has a decided ownership model, or it
will re-litigate the same seam. **Status of that dependency (2026-11-12): not final.** #734 settled one
half — an adopted native name is not the tool plane's to own — and #736 settled the cold-boot settlement,
which is why the joint acceptance is green; but the **ceiling-governance acceptance (A1) is still open**
(`J04` proves the pinned definition and a real execution, not that the approved call was bounded by the
Member's compiled ceiling). This WP therefore stays design-only and does not pick the owner model.
**Does not reopen:** the Alpha.5 Preview contract, `cand-v0.1.6-1/-2`, the frozen acceptance matrix
or the 0.1.6 release notes. Those describe the Member-scoped realm this phase starts from.

---

## 1. Why this work package exists — and the scope decision it corrects

In 0.1.6 the Alpha.5 realm is **Member-scoped**. `a5sf-governed-member` compiles a per-Member I/O
realm and the admission layer decides on the Member's calls; the release notes say so explicitly
("the realm is Member-scoped in this release", §1 and "What these notes do not claim").

The earlier phase decision — "the realm is a Member property, so scope the work to Members" — is
**corrected here**, for a measured reason, not a stylistic one:

- the **Leader/Root** turn is where `team_delegate`, `team_create_member`, control decisions and
  machine relays originate;
- the **Officer** session is where an Alpha.6 approval is decided and where the wake is delivered;
- an **ordinary Member** is the current subject of the realm.

A Member-only realm leaves the two identities that *authorise and route* execution outside the
governance boundary. That is the same class of gap P0-1 exposes on the tool plane: the thing that
decides can sit outside the thing that constrains. The correction is therefore: **the realm is a
property of every executing identity in the Team, not of the Member role alone.** The alpha.6
planes stay opt-in; the execution realm becomes the common floor.

This is a **scope correction of a future phase**, not a claim that 0.1.6 shipped it.

## 2. Covered identities

| identity | current state (0.1.6) | target property | explicit non-goal |
|---|---|---|---|
| **Root / Leader** | Outside the Alpha.5 governed realm. Its delegated work is attributed, but the Leader's own tool surface is not bounded by a compiled Member ceiling. | A Leader/Root turn that executes an I/O tool is either served by a compiled realm face or refused with a typed answer before execution. Delegation does not launder an out-of-lane call. | Not "the Leader becomes a Member"; the Leader keeps its control-plane tools. Not a rank-based bypass. |
| **Officer** | Runs as a Member-shaped instance but is not the subject of a compiled realm; its review decisions are governed by the Alpha.6 routing plane, not the Alpha.5 realm. | An Officer's tool calls (including any review-time I/O) are bounded by a realm derived from the same bound Team blueprint, with the same attribution. | Not a second approval authority; the Officer still decides, the realm only bounds what it may execute. |
| **Ordinary Member** | Governed on the opt-in preset (0.1.6 §2.1). | Unchanged semantics; the phase must not widen or weaken the Member realm to make the other two fit. | No regression of the Member-scoped guarantees. |

The three identities share one compiled Team realm plan; the per-identity envelope is a
restriction of it, never a substitute for it.

## 3. Dependencies (hard gates)

1. **PD-42 / P0-1 outcome.** The realm and the tool plane must have one owner for a governed
   dispatch. *(2026-11-12: the merge of #734 decided that the plane does not own an adopted native name;
   the remaining question — whether the approved call is bounded by the realm ceiling — is exactly what
   A1's dedicated suite measures, so this input is still open.)* AER's design takes that decided model as input; it does not choose it again. If P0-1
   resolves "the tool plane owns dispatch", AER must compile faces behind that plane; if it resolves
   "the realm owns the Body", AER must give Root/Leader a realm terminal. The two answers imply
   different work.
2. **PD-41 semantics.** One approval = one constrained dispatch attempt; consumption is not
   success; no replay. AER must not introduce a second consumption or an implicit retry when it
   routes an approved call through a new face.
3. **F-3 / P0-2.** Officer routing must be correct for the `parameter-permission` leg before an
   Officer realm is meaningful.
4. **PD-40.** A durable, session-scoped Stop is a prerequisite for claiming a durable per-identity
   execution floor: a realm that cannot be stopped durably is not an execution boundary.
5. **Host seams only.** `CORE PATCH BUDGET = 0`: no upstream source patch, no private API, no
   vendored fork. If a required seam does not exist publicly, the result is `CORE_SEAM_BLOCKER`,
   not a patch.

## 4. Boundaries — what this work package does not do

- **It does not reopen the Alpha.5 Preview.** The Member realm, the 0.1.6 contract, the frozen
  candidates, the `V@B` matrix cells and the release notes' "not a security boundary" statements
  stay as they are. AER is `v0.1.7`-or-later scope.
- **It does not add a second permission authority.** One permission decision point remains
  (Alpha.4 envelope ∩ Alpha.5 realm, plus the host's native authorisation). AER extends *coverage*,
  not authority count.
- **It does not claim OS isolation or malicious-agent containment.** Those remain out of scope and
  out of claim.
- **It does not implement the F-2 coverage-gate redesign.** That is a separate work package
  (`WP-F2-GOAL-DOMAIN-AUTHORITY.md`), even though both touch the final tool surface.
- **It does not reopen the "realm is Member-scoped" disclosure.** The 0.1.6 text remains true for
  0.1.6; AER supersedes it only for the later version and only with a dated entry.

## 5. Acceptance sketch (to be finalised after P0-1)

| id | arm | assertion | evidence class |
|---|---|---|---|
| **AER-1** | Root/Leader out-of-lane I/O | a Leader turn calling a tool outside the Team's compiled realm is refused at admission with a typed code and 0 provider/process; in-lane call executes and records a guard fact | DEV-LIVE, 2 agreeing boots |
| **AER-2** | Officer execution | an Officer's review-time tool call is bounded by the same compiled realm; an out-of-lane call is a typed refusal, not a silent success | DEV-LIVE, 2 runs |
| **AER-3** | Ordinary Member regression | the 0.1.6 Member realm arms still pass unchanged on the same artifact | C2-grade regression |
| **AER-4** | Approved dispatch inside the realm | with Alpha.6 ON, an approved call executes through the compiled face (or is refused before execution), never on an ungoverned plane | DEV-LIVE + C2 |
| **AER-5** | No second authority | the number and identity of permission decision points is unchanged; a grant/revoke still lands on the one authority | code read + host-free pin |
| **AER-6** | Durable Stop | after a durable pause, no identity (Root/Leader/Officer/Member) starts a new execution round | DEV-LIVE, 2 runs + cold boot |

## 6. Open questions for the Owner

1. Does the Leader get a **realm terminal** (its own confined faces) or a **delegation-only**
   envelope that refuses direct I/O? The second is smaller but changes the Leader's affordances.
2. Is the Officer's realm derived from the **same** Team blueprint or from the review leg's frozen
   identity? The first is simpler; the second is closer to how the approval leg freezes authority.
3. Does AER ship in `v0.1.7` as one unit, or as two slices (Root/Leader first, Officer second) with
   their own gates?
