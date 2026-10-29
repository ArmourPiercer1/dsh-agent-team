# G4 promotion re-review R2 — 2026-10-28

**Question.** Does G4 move from `G4-CORE-PASS / BRIDGE-BLOCKED` (2026-10-26; re-affirmed NOT-promoted at
R1 on 2026-10-28) to full `G4-PASS`? Rule unchanged: the fixed-SHA C2 conjunction on ONE frozen candidate
(execution-plan.md:124, :160; center-assembly-architecture.md §10.6): ARC-A + ARC-B + ARC-D + one real
named Bridge, plus the crash-survivor lane closed live.

**Packet.** Master `7a789a91d` after #432 #436 #437 #438 — frozen candidate
`5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3` (branch `task/u7-g4r3-live-20261028`, frozen 15:29:29Z
pre-boot, `CANDIDATE.md` committed in-candidate); five live legs committed under
`dev/agent-workflow/evidence/u7-g4r3-20261028/` with per-leg README sections written immediately after
each boot; boot ledgers (6 files, all starts declared pre-spawn); rulings B-G4R-1..6 with GATE-LEDGER
rows; receipts re-runnable at the #432 merge's first parent `4fd9c51ab`.

**Reviewers.** Two INDEPENDENT sessions, one model family each — the R3 stage-reviewer seat per user
routing (OpenCode Go `glm-5.3`) and an escalation-seat cross-check (`deepseek-v4-pro`). Neither read the
orchestration log, the gate ledger as truth, or each other's output; both recomputed every equivalence
claim personally (the R1 lesson: a prose "diff is empty" that had been false). Reports verbatim in this
directory: `G4-PROMOTION-REVIEW-R2-A-glm.md`, `G4-PROMOTION-REVIEW-R2-B-v4pro.md`.

## Verdicts

| Reviewer | Model | Verdict | Findings |
| --- | --- | --- | --- |
| A | dsh-opencode-go/glm-5.3 (R3 stage reviewer) | **投机通过**（有条件通过 — conditions are documentation/bookkeeping, executable in the promotion commit itself） | 0 CRITICAL / 0 HIGH / 3 MEDIUM / 3 LOW |
| B | dsh-opencode-go/deepseek-v4-pro | **投机通过**（gate may open with the risk ledger） | 0 CRITICAL / 0 HIGH / 2 MEDIUM / 1 LOW |

Both independently established from committed bytes: all five legs carry `overall: PASS` worst-case
records bound to the single candidate (read from each JSON), host `639ed01539…`, runtime porcelain-clean;
judge/suite/package/closed-lane bytes byte-identical candidate→tip (empty diff; the R1 laundering axis
cannot exist); verdict vocabulary unsoftened (`ENV_BLOCK` cannot reach PASS or exit 0); boot accounting
12/25 exact with every start pre-declared and every over-envelope cell carrying named ruling + independent
review + disclosure; receipts reproduce (`records=110 findings=0` / `added=56 findings=0` at merge scope /
whitespace clean); Jobs native-ctl is a REAL PASS on an unforgeable branded pre-flight (no ENV_BLOCK
laundering); the crash closure is LIVE, not equivalence, with the PASS-by-knob disclosed.

## Main-agent disposition

G4 is **promoted to `G4-PASS` in the 投机通过 (conditional) sense this project's precedent uses** (G3,
remediation-R1, U6-PR4 all recorded 投机通过 → GATE PASS with named carried residuals): the promotion
commit executes every condition both reviewers imposed, and the carried residuals are filed by name —
they are NOT cleared. **The release-path unlock this gate opens (G5/S5/Alpha.5) remains subject to the
user's 2026-10-29 ratification of accepting a 投机通过 with open MEDIUM residuals; that acceptance is
queued, not assumed.** Nothing here claims a clean 通过.

Reviewer A's conditions, executed in this commit:

1. **Ledger currency** (its F3, MEDIUM): dated GATE-LEDGER rows appended closing R-U6P3-1 (arc-b record),
   R-U6P4-1..3 (jobs record), R-G4R-1 PARTIAL (profile/oracle persisted; trustedSources digest carried as
   named residual), R-G4R-2 re-scoped and closed (#429 provisioning + per-record branded sandboxPreflight;
   partial-Landlock disclosure carried), and the crash pair as LIVE closure of R-G3-1/R-REM-1 with the
   PASS-by-knob caveat — each with its record citation.
2. **Residuals filed by name in the effective backlog** (BL-20..BL-23 in ALPHA5-EFFECTIVE-BACKLOG.md §B):
   R-CRASH-1 (supervisor hold/probe handshake + split aliased sequencing cells, post-freeze); trustedSources
   plane-digest exposure (closes R-G4R-1 fully when persisted + rebound); world-oracle dynamic-import edge
   (`host-sandbox-assets.mjs:223`, `complete=false` on ARC-D/Jobs — now disclosed in the lane README);
   tracked RCA copy (#439 — this promotion sits on top of it).

Reviewer B's LOW (trailing blank line at EOF of the post-#432 file
`dev/agent-workflow/evidence/review-routing-20261028/R438-og.md`): NOT edited — landed review reports are
immutable evidence; the #432 promotion scope itself is whitespace-clean (B verified); future scope will
drop the blank line opportunistically.

Reviewer A's F6: the lane README now quotes the final receipt values (dated addendum).

## Post-promotion state

- Gate: **G4-PASS (投机通过, conditional; carried residuals BL-20..BL-23 + standing
  partial-Landlock disclosure)** on candidate `5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3`.
- Boot lane closed at 12/25; B-G4R-5 pre-authorization EXPIRED by its own §5(a) upon this application.
- Next gate in plan order: G5 opens only under the user's PRODUCT-GATE ruling (§4 reserved — queued).
- R-G4R-3 (CI tightening) and R-CRASH-1 open post-freeze; family-class lanes now unblocked (candidate-
  bound evidence exists).
