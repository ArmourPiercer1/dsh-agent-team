# Alpha.6 rebase PoC — PR #536 (2026-11-02, real UTC)

Design source: [`alpha6-blueprint-router-wake-rebase-20261103.md`](../../../../docs/plans/memo/alpha6-review-separation/alpha6-blueprint-router-wake-rebase-20261103.md)
at PR #536 head `50e0147c2`. This directory is PoC evidence only: **no
production code is changed, no feature is enabled, no merge authorization is
implied.**

## Verdicts

| PoC | Verdict | What is green | What is not |
| --- | --- | --- | --- |
| **P-AUTH** | PASS with qualification | a single case-scoped predicate at the existing role-closure gate admits a designated non-Leader; the decision lands in the SAME ledger; the existing guard consumes it exactly once; non-designated / second-decision negatives hold | the predicate is hardcoded; the change is in the ARC-A protected center and needs a named Center-Interface PR + ledger override + user authorization; real session binding is not exercised here |
| **P-BP** | PASS | v3/v4 hashes pinned; the current entry refuses `reviewRouting`; an additive face resolves Template × Tool deterministically over the same frozen blueprint; instance selectors refuse; the family must move the hash, so a version boundary is required | final field names/version, `enabled:false`, `toolBindings` interaction and validator home are open |
| **P-INBOX** | seam PASS / model PASS / host ENV_BLOCK | public Inbox primitives suffice (append/claim/remove-before-claim/pending/turn); the latch model coalesces 3 asks to 1 wake and stays silent on resolved/no-progress work | real-Host 3-request / claim / crash / Stop behavior is not run — no Host world here and the wiring does not exist yet |

## Commands

```bash
# all probes (P-BP + P-AUTH base + P-INBOX model)
npx vitest run --config dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/vitest.poc.config.ts

# P-AUTH prototype leg (applies a throwaway patch, always reverts)
dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/P-AUTH/run-prototype.sh
```

## Disclosure

- The probes are outside `packages/*/test/**`; CI does not collect them.
- `P-AUTH/prototype.patch` is **not** a proposal and must never be applied to a
  production branch. It exists to prove one insertion point.
- The host facts under `P-INBOX/upstream/EXCERPTS.md` are quoted verbatim from
  the pinned SHA `639ed015397290b3745d163aafe02ffee4aa3f84` (`dsh-v0.2.0-rc.2`),
  with permalinks; the full upstream files are not vendored.
