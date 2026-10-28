# G4 promotion re-review R1 — 2026-10-28

**Question.** Promote the G4 gate from `G4-CORE-PASS / BRIDGE-BLOCKED` (2026-10-26) to full `G4-PASS` under the adopted rule: ARC-A + ARC-B + ARC-D + at least one real named Bridge, proven by fixed-SHA C2 (execution-plan.md:124, :160; center-assembly-architecture.md §10.6).

**Inputs.** Master `1e3ec41a6` after #413 #415–#424. The candidate packet `dev/agent-workflow/evidence/u7-g4i-20261028/` (#424, frozen candidate `e6589ef5f`) itself states PARTIAL / not independent-G4-ready. Named lane records: #420 ARC-D retry, #421 crash-survivor, #415 tbash boot 7, #418 AC-1 boot 8, #400 Jobs R2, #373 c2r3.

**Reviewers.** Two independent sessions (gpt-6.1-sol), neither involved in the implementation, with two mandates: (A) evidence validity, (B) adversarial. Neither read the orchestration log.

## Verdicts

| Reviewer | Mandate | Verdict on promotion |
| --- | --- | --- |
| A | evidence validity | **补充内容** |
| B | adversarial | **阻塞** (promotion); keeping the existing core status would be 投机通过 |

**Main-agent ruling: G4 is NOT promoted.** The gate stays `G4-CORE-PASS / BRIDGE-BLOCKED`. The decisive reason is the one both reviewers name: the rule asks for a fixed-SHA C2 conjunction, and on the frozen candidate only ARC-A carries a live finalized overall-PASS record. ARC-B, ARC-D and the Bridge exist only as records from older trees whose dependency sets were changed afterwards (DEPENDENCY-EQUIVALENCE.md classifies every such receipt AFFECTED). The candidate lane's 4-start budget was spent before those were rebound.

I do NOT treat this as a CORE_SEAM_BLOCKER or a plan contradiction. It is unexecuted evidence work, with no product defect found, and both reviewers' structural attacks on centre integrity, the single kernel and the disk oracle survived.

## Per-item status on candidate `e6589ef5f` (merged reviewer findings)

| Item | Status | Evidence / reason |
| --- | --- | --- |
| ARC-A (centre unchanged by family additions; search legs) | **PROVEN-ON-CANDIDATE** (binding PARTIAL) | `u7-g4i-20261028/c2/arc-a/run-record.json` overall PASS 10/10, teamSha e6589ef5f, tree clean, host 639ed01539. The runner does not persist the composed-profile/trusted-source/world-oracle digests (explicit nulls). Protected-centre ledger: 33 booked + 3 named overrides (#377→#392, #391), no unnamed centre move (reviewer B). |
| R-G3-1 / R-REM-1 (crash survivor) | **PROVEN by equivalence** | #421 record overall PASS with fail-closed probes and the strict interval. teamSha d8f40c0d, but `git diff d8f40c0d..HEAD -- packages scripts` is empty; later deltas are tests/world-factory + evidence only (reviewer A accepts this as a real equivalence argument). The in-record `teamTreeClean` means host-tree pristine (disclosed; renamed `hostTreePristine` + real Team field). |
| ARC-B (read/FS + bash/process: one decide+consumeOnce, deny/cancel/cleanup before the body) | **HISTORICAL-ONLY** (structurally SURVIVED) | tbash boot 7 is PASS but its tree was dirty (96dd541e) and the path is AFFECTED; no candidate rerun. |
| ARC-D (adversarial negatives, restrict/lift, E1) | **HISTORICAL-ONLY** | #420 retry overall PASS at 752e713a2 is strong (direct-disk CI-03, pair PASS), but agent-control runtime/manifest changed afterwards (#418) → AFFECTED. The E2 matrix is offline only. |
| Real named Bridge (Jobs) | **HISTORICAL-ONLY / not on candidate** | #400 Jobs R2 overall PASS at 46b2c139f covers attribution, ring, list, kill, refusal and exactly-once, but controlled-FS/client/manifest changed afterwards → AFFECTED. Candidate start 4 was interrupted (no record). The `native-ctl-unaffected` leg is ENV_BLOCK on this host: bwrap cannot create unprivileged user namespaces, so the host's native workspace-write bash fails closed with SANDBOX_UNAVAILABLE. That is not a Team defect and not a PASS. |
| R-REM-2 / R-REM-3 | HISTORICAL-ONLY | #373 c2r3 overall PASS at a8ea8ccf; FS changed since (#409/#417). |
| AC-1 agent-control (#418) | NOT-PROVEN live on candidate | boot 8 predates product fixes; L4 levels honestly DISCLOSED. |

Reviewer B also records: re-grades (#418 fork) and provenance annotations (#421) are honest disclosures, but they cannot substitute for candidate C2. No forged overall-PASS was found.

## What closes it (minimal, recorded as the next lane: G4-R)

On ONE freshly frozen clean candidate (after all runner/product changes), with Host 639ed01539 and one authority/config/source digest set, produce finalized `overall: PASS` records for:

1. **ARC-B** — governed bash: allow-once / replay refusal / other-command refusal / deny zero-effect / cleanup. One boot.
2. **ARC-D** — registration generation, scope, revocation/lift, cold start, teardown, `restrict-veto` + `lift-control`, direct-disk CI-03. One boot.
3. **Real Bridge (Jobs)** — attribution, ring bytes, list owner, live kill, finished-kill honesty, cross-scope/unattributed refusal, exactly-once approval. One boot. The native-ctl leg is recorded as ENV_BLOCK with the bwrap evidence; the Bridge verdict must not depend on it. If the judge's overall would be non-PASS solely because of that native leg, the reviewer must rule on that explicitly (precedent: ENV_BLOCK is never PASS).
4. Runner persists the composed-profile / trusted-source / world-oracle digests, so the binding is complete instead of null.
5. Keep ARC-A on the same candidate (rerun if the candidate moves) and keep crash-survivor equivalence or rerun it (2 starts) if its dependency set changes.

Budget for G4-R: 3 starts for items 1–3, +1 retry only for ENV or a harness defect fixed in between, +2 if crash-survivor equivalence breaks. No over-budget boots without a new main-agent ruling.

## Carried risks

- **R-G4R-1** — candidate binding fields (profile/source/oracle) are null in runner output; must be persisted before G4-R.
- **R-G4R-2** — host sandbox: unprivileged user namespaces are unavailable on this machine, so every native workspace-write leg is ENV_BLOCK here. Lanes needing native confinement need a host where bwrap works, or an explicit ENV_BLOCK ruling.
- **R-G4R-3** — `eb3-tool-acceptance` checks honesty, not completeness: it does not require `overall: PASS` on cited records (audit finding). Tightening it is a separate CI change, not done here.
