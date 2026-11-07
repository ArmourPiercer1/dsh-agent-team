# Alpha.6 root wiring and v5 activation — implementation plan (proposal, not authorized)

Status: **PROPOSAL / NOT EXECUTED**. PR #571 remains DRAFT; no v5 flip, no root
wiring, no production enablement.

## 1. Why this is a separate authorization step

Everything below changes what the production Host parses or enables. The
external review (2026-11-04) explicitly withholds production integration until
the turn lifecycle, persistence and facts-provider work is accepted. The code
needed to perform the change now exists and is tested offline:

- `createAlpha6RootComposition` — parses the bound v5 source once, decides
  legacy/refused/alpha6, and returns BOTH trusted Control ports.
- `createAlpha6AuthorityGenerationReader` — durable overlay generation for the
  RESOLVED reviewer.
- `createAlpha6CategoryLookup` — fixed Leader/Human categories from the closed
  control kinds.
- `wake-intent.ts` + `wake-dispatch.ts` — queued/claim/release and recovery.

## 2. Root wiring shape (when authorized)

1. Add an explicit opt-in field (for example `alpha6ReviewRouting?: boolean`)
   to `TeamPluginConfig`. Absent/false MUST keep Alpha.5 byte-identical.
2. At `createControlService` time, call `createAlpha6RootComposition` with:
   - `config.blueprintSource` (the SAME source the router consumes);
   - `rootSessionId`, `leaderTemplateId`;
   - a LIVE member lookup over `domain.repositories.memberInstances` (NOT a
     startup snapshot: members are created after the service);
   - `control.readControlState`;
   - the Host permission-overlay port.
3. Pass the returned ports into `createControlService` ONLY in `alpha6` mode.
   `legacy` keeps today's construction; `refused` must not silently notify the
   Leader — it holds/refuses.
4. The factory currently takes a member snapshot for the unique-Officer
   decision. Production must either:
   - resolve the decision per routing event from the live lookup (preferred,
     matching the router's own `currentOfficer` semantics), or
   - rebuild the composition when the member view changes (a lifecycle hook,
     not a timer).
   This choice is the remaining design point; it must not become a second
   scheduler.
5. Wire wake delivery only after the Host exposes a real claim boundary:
   `claimReviewWake` at turn start and `releaseAndDeliverReviewWake` at turn
   end. No synthetic turn events.

## 3. v5 activation (single reversible stroke)

1. Add `5` to `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS`.
2. Add the v5 branch to `validateBlueprintDocument` and the v5 hash projection
   to `parseBlueprint`, mirroring the v4 dispatch (delegate the v4 core,
   restamp, then attach `reviewRouting`).
3. Keep `parseAlpha6Routing` as the single v5 parser for Alpha.6 consumers; it
   must not become a second catalog.
4. Tests required before merge:
   - v5 catalog round-trip + content hash stability;
   - v3/v4 byte-identical regression;
   - v5 Team creation, Officer creation, approval, escalation, transfer,
     cancel/recover over a real Host;
   - refusal paths: zero/multiple Officer, missing routing, wrong Blueprint
     revision, transferred leg, self-review.
5. Rollback: revert the single activation commit (const + dispatch + hash
   branch). Alpha.6 opt-in stays false by default, so a rollback never strands
   a live team on unparseable rows; v5 documents authored under the flip remain
   readable by the reverted build only if the flip is rolled back before any
   team is created.

## 4. Evidence still required

- full local gate 9/9 at the final head (census identity set identical);
- ARC-A named overrides for every protected-center edit;
- real Host E2E evidence (session ids, inbox rows, leg/transfer rows, zero
  Leader notifications for an assigned Officer allow);
- independent review GO before merge.

## 5. What is explicitly NOT planned

- No second approval ledger.
- No timer/seven-phase scheduler.
- No fake Leader or global Member widening.
- No merge, release or production authority switch under this proposal.
