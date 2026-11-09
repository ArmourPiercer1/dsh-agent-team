# Runbook — a control request abandoned as `invocation-abandoned`

**Applies to:** the opt-in experimental Alpha.6 approval plane in `0.1.6`.
**Defect:** A6-26 (see `RELEASE-NOTES-0.1.6.md` §5).
**Scope:** one durable control request that an Inbox wake accepted, but no turn ever claimed, and a
crash converted into a terminal abandonment. This page is the operator procedure; it does not change
any product behaviour.

---

## 1. What you will see

The failure is quiet. There is usually no error in the UI at the moment of the crash; the symptoms
appear after the restart:

| Signal | What it looks like |
| --- | --- |
| Durable ledger row | `factType: "control-request-abandoned"` with payload `reason: "invocation-abandoned"` |
| Request state | the durable request cannot be decided; a later `team_resolve_control` is refused |
| Typed error | `CONTROL_REQUEST_ABANDONED` ("can never become an allow") |
| Inbox | the wake is not redelivered; wake-turn count stays where it was |
| Projection summary | `ledgerSummary.pendingControlCount` can read **0** even though the request is still in the ledger |

The measured instance is `dev/agent-workflow/evidence/a6-gaps-g2-unclaimed-r11/`:

```text
accepted wake=review-wake:...:a6wake%3Av1%3A1%3Aa56bd830
busy=true  wakes=0->0->0  intent rows=1->0->0
pendingBefore=1  pendingAfter=0  pendingCount=0
abandoned=1  recoveryCode=CONTROL_REQUEST_ABANDONED  verdict=abandoned-terminal
```

Note the two different meanings in that line: `pendingAfter=0` is the **durable request** no longer
being pending (it is terminal), while `pendingCount=0` is the **projection summary** count. Neither
means "nothing happened".

---

## 2. Recognise it correctly

A `control-request-abandoned` row closes a control request. It is **not** the same thing as:

- a **decision** (`allow` / `deny`) — a decision decides a live request;
- an **escalation** — an escalation closes a *leg* and still carries a terminal decision row;
- a **corrupt leg** — a corrupt leg was never governable and has its own visibility list.

The distinguishing payload for A6-26 is `reason: "invocation-abandoned"`. An abandonment with a
different reason (for example `wait-aborted`) has a different cause and may not have the same
at-most-once story; read the row's payload and the surrounding ledger before reusing this runbook.

The public `team_list_pending_control` view lists live pending cases. An abandoned request is
terminal, so it is **not** expected to appear there. Use the ledger, not the pending list, to prove
whether a request existed.

---

## 3. Find the request by id on the public ledger page

The ledger is append-only. The request row survives the abandonment and is discoverable by its id.

1. Take the request id (`ctrl-…`) from the alert, the Member transcript, the review-wake row or the
   abandoned fact.
2. Page the public ledger with `team.getLedgerPage`:

   ```json
   { "teamSessionId": "<rootSessionId>", "afterSequence": 0, "limit": 50 }
   ```

   Repeat with `afterSequence = nextAfterSequence` until `nextAfterSequence` is `null`. Defaults are
   `afterSequence: 0`, `limit: 50`; `total` is the ledger's fact count.
3. In the returned `entries`, match `payload.requestId` (and the row's `sequence`) against the id.
   The rows you are looking for are:

   | `factType` | Meaning |
   | --- | --- |
   | `control-request-recorded` | the request was created; payload carries `requestId`, subject, requester and authority scope |
   | `control-decision-recorded` | a decision exists (if any) |
   | `control-allow-consumed` | an allow was consumed; **this is the side-effect-relevant row** |
   | `control-execution-result` | a terminal execution result (`succeeded` / `failed`) exists |
   | `control-request-abandoned` | the terminal abandonment; payload carries `requestId`, `rootSessionId`, `abandonedAt`, `reason` |

4. Record the sequence numbers. A request with `control-request-recorded` and
   `control-request-abandoned` but **no** `control-allow-consumed` and **no**
   `control-execution-result` is the A6-26 shape: accepted, never claimed, never executed.
5. The same rows are visible in the Team ledger page in the UI. The page is a view over the same
   `team.getLedgerPage` read; do not treat a filtered "pending" badge as the inventory.

### Why `pendingControlCount` can read 0 while the request is visible by id

`pendingControlCount` is a derived **pending** summary. The projection excludes a request as soon as
it has a terminal mark, and a `control-request-abandoned` row is terminal (it beats a decision, by
design). The abandoned request is therefore *not pending* and the count is 0 — while the request
itself is still an append-only row and is returned by id.

This is a recorded **P2** defect: the summary undercounts "requests that need human attention"
because "terminal" and "needs attention" are different questions. Operational rule: **when an id is
known, use the ledger page; never use `pendingControlCount` to decide that no request existed.**

---

## 4. Decide whether re-issuing is safe

Recovery for A6-26 is **re-issue**, not resolve. `team_resolve_control` on the abandoned request is
refused with `CONTROL_REQUEST_ABANDONED`; retrying it cannot turn the request into an allow.

Re-issue means **a new ask with a new request id**. It is not a retry of the old id and it does not
"un-abandon" anything.

### 4.1 Safe to re-issue

All of the following must hold:

- the abandoned request has **no** `control-allow-consumed` row;
- it has **no** `control-execution-result` row;
- the Member's durable transcript shows the turn never started or never received the wake (the A6-26
  accepted-but-unclaimed case);
- the underlying action is idempotent, or the operator can prove it did not happen.

Re-issue the same *intent* with a fresh request id, and keep the old id in the incident note so the
first request is not lost from the audit trail.

### 4.2 Not safe to re-issue blindly

**Do not** re-issue when any of these is true:

- a `control-allow-consumed` row exists for the request — the allow was consumed, so execution may
  have started;
- a `control-execution-result` row exists (especially `failed`) — the call reached the backend;
- the ledger/transcript is ambiguous about whether the call ran ("outcome unknown") — a crash can
  land between "decided" and "observed", and re-issuing can duplicate a side effect;
- the action is non-idempotent (a write, a payment, a message, an external mutation) and you cannot
  prove it did not happen.

In those cases the correct first move is **evidence collection**, not a retry: read the Member
transcript, the durable execution-result fact and the target system's own record. Treat the original
call as **at-most-once** and decide with the action's owner whether a duplicate is acceptable. A
re-issue is then a new, explicitly authorised action — never a reflex.

### 4.3 Never do

- Do not retry `team.resolve_control` against the abandoned id.
- Do not reuse the abandoned request id.
- Do not delete or rewrite ledger rows; the ledger is append-only and is the only proof of what
  happened.
- Do not infer safety from `pendingControlCount: 0` (§3).

---

## 5. Procedure

1. **Capture the id** and the team session id.
2. **Read the ledger page** from sequence 0, paging to the end; find the request row, any decision,
   any allow consumption, any execution result and the abandonment row (§3).
3. **Read the Member transcript** for the session that was supposed to receive the wake. Confirm
   whether the wake turn was claimed.
4. **Classify:** safe to re-issue (§4.1) or evidence-first (§4.2).
5. **If safe:** re-issue the intent with a new request id; record the old id, the new id, the
   classification and the evidence path in the incident note.
6. **If not safe:** stop; collect the target system's record and escalate to the action owner. Do not
   retry.
7. **Verify:** the new request produces its own `control-request-recorded` row and either a decision
   or a new abandonment. The old request remains abandoned; that is expected and must not be
   "fixed" by editing history.

---

## 6. What this runbook does not do

- It does not make the abandoned request decidable.
- It does not redeliver the lost wake or reconstruct the review.
- It does not change A6-26 or turn the experimental Alpha.6 plane into a stable promise.

The release-level narrowing is stated in `RELEASE-NOTES-0.1.6.md` §5: an accepted wake can end in a
durable, discoverable, side-effect-free abandonment, and recovery is re-issue.

## Evidence pointers

- A6-26 measurement: `dev/agent-workflow/evidence/a6-gaps-g2-unclaimed-r11/`
- Claim-time recovery control: `dev/agent-workflow/evidence/a6-gaps-g2-claimed-r10/`
- Alpha.6 close-out summary: `dev/agent-workflow/evidence/a6-gaps-final/`
- Release notes: [RELEASE-NOTES-0.1.6.md](./RELEASE-NOTES-0.1.6.md)
