# P-INBOX — lightweight activation / poll / latch (executed 2026-11-02, real UTC)

Three separate verdicts, deliberately not collapsed into one green:

| Part | Verdict | Evidence |
| --- | --- | --- |
| Seam contract on the pinned Host source | **PASS (seam only)** | `source-witness.md` + `upstream/inbox.ts`, `upstream/agent.ts` at `639ed01539` |
| Coalescing law (pure model) | **PASS** 7/7 | `latch.mjs`, `latch-model.test.ts` |
| Real-Host 3-request / crash / Stop behavior | **ENV_BLOCK — not run** | no host world in this workspace, and the routing/wake wiring does not exist yet |

## Model results

```
npx vitest run --config …/vitest.poc.config.ts …/P-INBOX/latch-model.test.ts
```

- 3 concurrent asks while idle → **1** wake; the generic wake carries no
  per-request payload and the turn reads the authority (A, B, C).
- asks during `running` → dirty only; turn end emits **at most one** follow-up.
- a turn that emptied the authority → **0** follow-up.
- a resolved case cannot justify a new wake; an unclaimed stale generic wake
  can be withdrawn (`cancelIfStale`) but a claimed one cannot.
- same pending version + same ids after a no-progress turn → **no** re-wake
  (the loop guard).
- crash recovery resets the freshness baseline and re-wakes for still-pending
  work; recovery with nothing pending is silent.

## Why the Host leg is ENV_BLOCK, not a green

1. `tests/deepseek-harness-test-use` is absent in this workspace (the designated
   pristine checkout), so there is no bootable Host tree.
2. Even with a Host tree, P-INBOX's end-to-end cases (3 concurrent asks,
   resolve-before-delivery, claim-then-new-request, handoff, Stop/restart)
   exercise the **routing + wake wiring this PR does not implement**. Booting a
   Host would only re-test the existing followup path, not the new design.

Unblock recipe (implementation phase):

- provision `tests/deepseek-harness-test-use` at `639ed01539` via
  `tests/paths.mjs` and the `tests/world-factory` budget ledger;
- land PR-A6-3 (wake coordinator, generic wake id, latch) and PR-A6-4
  (Officer access) in dormant form;
- add a C2 suite with the PR #536 §4 final-behavior matrix and measure
  Leader/Officer model requests, tokens, notification count, approval
  reachability and wait time — not module coverage.

## Seam caveat the design must keep

`claim` removes the batch before the model turn; `remove/replace` return false
after that. So the design may say "withdraw an unclaimed stale wake", never
"cancel a claimed one". The final decision always re-reads the Case.
