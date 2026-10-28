# RV-406 — Recovered round-1 security review of PR #406

- **What this is:** `REVIEW-r1.md` is the round-1 targeted security review of **PR #406** (U7-F agent-control family). Verdict: **PASS-WITH-FINDINGS** (F-1 HIGH, F-2 MEDIUM, F-3 MEDIUM).
- **Provenance:** the review body existed **only** in local commit `5ee449a04` on branch `task/u7-406-review-20261026` (worktree `.worktrees/rv-406`) and was **never pushed before PR #406 merged**. It was recovered to `.artifacts/recovered/u7-406-review-r1-REVIEW-unlanded.md` and is landed here late, verbatim, per remediation-ledger item **RV-406** (P3): land as standalone evidence, do not silently drop.
- **Ledger citation (path only):** `dev/agent-workflow/evidence/review-routing-20261028/REVIEW-REMEDIATION-20261028.md` — that file lives on PR #433's branch and may not be present on this branch at landing time.

## Status of this document

This document is **evidence**. It lands **no gate verdict** and does **not re-open #406**. The findings it raised (F-1/F-2/F-3) were **findings dispositioned at the time; re-verify severity against current code before any new action**.
