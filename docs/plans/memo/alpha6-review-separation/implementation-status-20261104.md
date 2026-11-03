# Alpha.6 — implementation status (2026-11-04)

Status: **DRAFT implementation record. PR #536 remains DRAFT / DO-NOT-MERGE;
current authority is still Alpha.5.** This file describes what is assembled in
draft integration PR #571 and what is deliberately NOT enabled.

## 1. What is assembled

| Slice | PR | State |
| --- | --- | --- |
| Blueprint v5 grammar + shared router | #562 | implemented, dormant (`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS=[3,4]`) |
| ReviewWakeCoordinator | #563 | implemented, pure reducer |
| ReviewCapability evaluator | #564 | implemented, pure |
| Control/PA review chain | #565 | implemented, real-service tests |
| Current-leg transfer / handoff | #566 | implemented, durable fact |
| Restricted Officer access | #567 | implemented |
| Inbox delivery seam | #568 | implemented, real Host test 2/2 |
| opt-in composition / notifier | #570 | implemented, test-only adapter |
| integration stack | #571 | assembled, DRAFT |

Integration-only modules:

- `packages/runtime/alpha6/wake-plan.ts` — every pending leg goes through
  `ReviewRouter`, then routes merge per recipient. Three ordinary asks produce
  ONE wake; hold/human routes are surfaced, never delivered.
- `packages/runtime/alpha6/wake-dispatch.ts` — consumes that plan and drives
  `ReviewWakeCoordinator`: one delivery per latch, poll during an active turn
  only dirties, delivery failure is `delivery-failed` and retryable.
- `packages/runtime/alpha6/composition.ts#parseAlpha6Routing` — parses the bound
  Blueprint's v5 `reviewRouting` exactly once for every consumer.

## 2. Review P0 corrections

### 2.1 No direct notifier on the production root path

`root.ts` still installs the legacy Leader notifier. The PR6 compose adapter
(`alpha6/notifier.ts`, `alpha6/wiring.ts`) exists for its own tests and is NOT a
production path. The declared main path is:

```text
Control WorkChanged
  -> authoritative Case/leg scan
  -> ReviewRouter
  -> per-recipient merge (wake-plan)
  -> ReviewWakeCoordinator (wake-dispatch)
  -> DSH Inbox
```

### 2.2 `refused` is not `legacy`

`decideAlpha6Composition` returns:

- `legacy` only when the Team did not opt in (`enabled !== true`);
- `alpha6` only when v5 + routing enabled + exactly one legal Officer;
- `refused` for every explicit opt-in that cannot satisfy the conditions.

A refused decision throws in the adapter. It never silently notifies the
Leader. Tests pin: disabled, v4, two Officers, no wake seam.

### 2.3 Assigned-Officer review uses the single evaluator

`assignedOfficerCapability()` no longer mints `ReviewCapabilityCandidate.of()`
by hand. It builds `ReviewCallFacts` from the durable leg and calls
`evaluateReviewCapability()`. A narrow trusted overlay port supplies only the
facts the durable row cannot carry today:

- Blueprint `reviewRouting`;
- `fixedLeaderOrHumanCategory`.

`requiresHuman` derives from the current rung. `perEffectRequiredAuthorities`
is already durable. Reviewer/current-Officer identity stays a decision-time
fact; it is never persisted as authority.

The PR5 spec proves a distinct Officer allow/escalate is accepted and
self-review is refused with `operation-owner-is-officer`.

### 2.4 Routing provenance

`parseAlpha6Routing()` returns `null` for a v4/unparsable document; callers map
that to `refused`, never to a v5 default. The same parsed routing must feed the
router, the control facts overlay and the dispatcher; a second parser is a bug.

## 3. Tests and gates

- Static default gate: 8/8 PASS (`census` skipped by name).
- Full gate: 8/9. The census leg has only known load-sensitive reds outside
  Alpha.6 (`alpha5-glob-backend X3`, `alpha5-search-backend P11`,
  `u6-mcp-017` variants). Do not report 9/9.
- ARC-A protected-center digests are booked for the intentional
  `control/service.ts` and `control/types.ts` edits.
- Lane-hygiene specs tolerate a concurrently removed test temp directory.

## 4. Deliberately not done

- No root Alpha.6 wiring.
- No `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS=[3,4,5]` flip.
- No durable `reviewRouting` snapshot on the control leg yet (option A).
- No Host full-chain E2E.
- No merge, production enablement, authority switch, or release.

## 5. Required before any root wiring

1. Promote routing to a durable leg snapshot (or keep the trusted port as the
   single source) and prove router/control/dispatcher agree byte-for-byte.
2. Host E2E: create a v5 Team with one Officer, route an ordinary ask, merge
   three asks into one wake, approve, escalate to Human, transfer the current
   leg, cancel and recover a turn.
3. Re-run full gate and attach real Host evidence.
4. Only then ask for production enablement under separate approval.
