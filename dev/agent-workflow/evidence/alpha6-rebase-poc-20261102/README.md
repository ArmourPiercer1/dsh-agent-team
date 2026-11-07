# Alpha.6 rebase PoC — PR #536 (2026-11-02, real UTC)

Design source: [`alpha6-blueprint-router-wake-rebase-20261103.md`](../../../../docs/plans/memo/alpha6-review-separation/alpha6-blueprint-router-wake-rebase-20261103.md)
at PR #536 head `50e0147c2`. This directory is PoC evidence only: **no
production code is changed, no feature is enabled, no merge authorization is
implied.**

## Verdicts

| PoC | Verdict | What is green | What is not |
| --- | --- | --- | --- |
| **P-AUTH** | simple Control seam PASS; full PA chain FAIL under base law; delegation prototype PASS; contract decided by ADR-A6-1 (implementation not started) | the role-closure predicate admits a designated non-Leader; the decision lands in the SAME ledger; the guard consumes it exactly once. The full PA chain was then tested with a real strict manifest + real verifier: under a `member` Officer the resolve gate records `pa-authority-drift` and mints nothing; a throwaway reviewer-authority mapping makes the same chain mint + consume, proving the insertion point | production contract = ADR-A6-1 ReviewCapability (one pure evaluator; decision snapshot; Control/PA/Grant/Guard read the same snapshot; no per-case Mandate); implementation not started; both patches are hardcoded and never mergeable |
| **P-BP** | PASS (12/12) | v3/v4 hashes pinned; the current entry refuses `reviewRouting`; an additive face resolves Template × Tool deterministically over the same frozen blueprint; instance selectors refuse; the family must move the hash. Review additions: Officer must be a MemberTemplate; Officer's own ask routes to Leader | final field names/version, `enabled:false`, `toolBindings` interaction and validator home are open; version number must be coordinated with Alpha.5 |
| **P-INBOX** | seam PASS / model PASS 11/11 / host ENV_BLOCK | public Inbox primitives suffice (append/claim/remove-before-claim/pending/turn); the latch coalesces 3 asks to 1 wake, stays silent on resolved/no-progress, does not cancel pending-unchanged, adopts a surviving wake on recovery, and releases a failed delivery | real-Host 3-request / claim / crash / Stop behavior is not run — no Host world here and the wiring does not exist yet |

## Commands

```bash
# all probes (P-BP + P-AUTH base + P-INBOX model)
npx vitest run --config dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/vitest.poc.config.ts

# P-AUTH simple seam prototype (applies a throwaway patch, always reverts)
dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/P-AUTH/run-prototype.sh

# P-AUTH FULL PA chain: base / role-only / delegation (patches always revert)
dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/P-AUTH/run-pa-chain.sh
```

## Disclosure

- The probes are outside `packages/*/test/**`; CI does not collect them.
- `P-AUTH/prototype.patch` and `P-AUTH/delegation.patch` are **not** proposals
  and must never be applied to a production branch. They exist to prove the
  entry point and the reviewer-authority insertion point respectively.
- The 2026-11-02 review re-rated P-AUTH: the simple Control seam is not the
  full PA chain. See `P-AUTH/RESULTS.md`.
- The host facts under `P-INBOX/upstream/EXCERPTS.md` are quoted verbatim from
  the pinned SHA `639ed015397290b3745d163aafe02ffee4aa3f84` (`dsh-v0.2.0-rc.2`),
  with permalinks; the full upstream files are not vendored.
