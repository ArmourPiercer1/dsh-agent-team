# Runbook — a review wake was accepted but never claimed

**Applies to:** the opt-in experimental Alpha.6 approval plane (`reviewRouting`) on DSH `0.2.0-rc.2`,
product tree `0.1.6` and later (`origin/master` @ `84baf304c`, 2026-11-12).
**Defect / row:** PD-39 Gap 2 (audit `A6-GAPS-26`, second meaning — see the id-scope note in
`RELEASE-NOTES-0.1.6.md` §5).
**Scope:** one durable review wake that the native Inbox **accepted** (`wake-*.json` with
`status: "accepted"`) and that no turn ever **claimed**, followed by a Host crash/restart on the same
`DSH_HOME`. This page is the operator procedure; it changes no product behaviour and adds no
redelivery.
**Measured on:** `dev/agent-workflow/evidence/pd39-inbox-window-20261112/` (two real-Host runs of this
exact window, plus one run of the terminal-abandonment trigger; `DEV-LIVE`, no `V@B`).

> **What is promised.** Not "every accepted review wake is delivered or decidable". The true
> statement for this artifact is: **delivered, decidable, or terminally abandoned with a typed
> `control-request-abandoned` fact naming the request and an operator-visible re-issue path.** The
> two acceptable outcomes below are measured; the abandonment is measured on its own trigger.

---

## 1. Detect it (what the durable rows look like)

The crash is quiet: no error at crash time. After the restart the wake simply does not run, and the
Inbox is empty. Use the ledger, never the UI alone.

1. **The wake intent row** lives under the Alpha.6 intent directory
   (`<DSH_HOME>/alpha6-wake-intents/wake-*.json`). Before the crash it reads:

   ```json
   {
     "key": { "rootSessionId": "session-…", "reviewerInstanceId": "inst-…", "sessionGeneration": 1 },
     "wakeId": "review-wake:…:a6wake%3Av1%3A1%3A<fp>",
     "workFingerprint": "a6wake:v1:1:<fp>",
     "ownerRootSessionId": "session-…",
     "status": "accepted"
   }
   ```

   After the restart the file is **gone** (`1 → 0`). That is the recovery clearing the intent — it is
   **not** a delivery. Measured: `rows=1->0->0`, `wakes=0->0->0` (no new wake turn, no redelivery).

2. **The durable request** is in the Team domain store (`<DSH_HOME>/storages/team_domain.json`,
   `tables.ledger["<sequence>"]`, JSON values) and on the public ledger page. The row that matters is:

   ```json
   {
     "sequence": 7,
     "factType": "control-request-recorded",
     "createdAt": "2026-11-12T15:27:30.589Z",
     "payload": {
       "requestId": "ctrl-154qf5f1dlcvt00vmsenl0bp",
       "kind": "leader-approval",
       "actionName": "parameter-permission",
       "toolName": "bash",
       "requestedEffect": "allow",
       "correlation": "call-c1-9lheq5ab",
       "approvalCaseId": "case-07kwp0h0la6z220c1tiev046"
     }
   }
   ```

   Read it with `team.getLedgerPage` (`{ "teamSessionId": "<rootSessionId>", "afterSequence": 0,
   "limit": 50 }`, then `nextAfterSequence` until `null`). An **undecided** request (no
   `control-decision-recorded`, no `control-request-abandoned`) that nobody can see in a pending list
   is this window.

3. **The count.** `ledgerSummary.pendingControlCount` (and `team_list_pending_control`) count
   **live-undecided** requests only. In the measured window it reads **1** — the request is still
   pending and discoverable by id. It reads **0** only when the request is terminal (decided or
   abandoned); "0" never means "nothing happened".

---

## 2. What is true after the restart

Two outcomes are possible, and they are told apart by the **terminal rows**, not by the count alone.
Both are `at-most-once`: the crashed Member invocation is **never revived** (Scheme A), and no
duplicate execution is created.

### A. The request is still pending and decidable (measured twice, 2026-11-12)

- wake intent rows `1 → 0 → 0`; **0** new wake turns (`claimedWakeTurnsAfterRestart = 0`);
- `control-request-recorded` survives; **no** `control-decision-recorded`, **no**
  `control-request-abandoned`, **no** consumption, **no** execution result;
- `pendingControlCount: 1`, `requestFactVisible: true`;
- `team_resolve_control` on the exact `requestId` **succeeds** (measured: a v4 `team.resolveControl`
  allow from the boot-root operator principal returned `status: 200` and wrote
  `control-decision-recorded` with `decision: "allow"`).

This is the acceptable outcome (ii) of the audit: stranded but **discoverable and resolvable**. The
wake itself is not redelivered; the request is decided by an operator by id.

### B. The request is terminally abandoned (measured on the dead-invocation trigger, 2026-11-12)

This shape arises when a **decision already exists** (typically `allow`) and the process died before
the invocation consumed it (`consumed = 0`, no `control-execution-result`). On the restart, boot
settlement closes the dead invocation:

```json
{ "sequence": 14, "factType": "control-request-abandoned",
  "payload": { "requestId": "ctrl-…", "reason": "invocation-abandoned" } }
```

- the request is **terminal**: a later `team_resolve_control` is refused with the typed
  `CONTROL_REQUEST_ABANDONED` ("can never become an allow");
- `pendingControlCount` excludes it (0) and `team_list_pending_control` does not list it — by design;
- zero consumption, zero execution, no revival of the crashed call.

> **Correcting the 0.1.6 wording.** The 0.1.6 evidence (`a6-gaps-g2-unclaimed-r11`) reported the
> abandonment as if boot recovery abandoned the *accepted wake*. It does not: settlement only closes a
> request that already has an `allow`. In that run the abandonment was written when the resumed
> Officer turn **resolved allow** on a `parameter-permission` row that carried
> `reviewPayloadDigest === operationFingerprint` with a non-PA `reviewPayload`; the classifier read it
> `PA_MANIFEST_CORRUPT` and the A6 undetermined-allow path turned the refusal into an abandonment. The
> current tree's `parameter-permission` rows carry no `reviewPayloadDigest`, so the same window now
> ends in outcome A. If you see an abandonment on a `parameter-permission` row, read its
> `reviewPayloadDigest` before concluding anything about the wake.

---

## 3. What to do

**Before acting:** check whether the original call could already have had side effects. In outcome A
nothing was consumed and nothing executed (the Member's wait died with the process); in outcome B the
settlement fact says the same (`consumed = 0`, no execution result).

### Outcome A — pending request

1. Decide the durable request by id: `team_resolve_control` with the exact `requestId` (allow/deny).
   This is a decision about the **request**, never a revival of the crashed invocation: the Member's
   blocked call stays dead.
2. If the work is still needed, **re-issue the ask** (a new ask from the Member, or a new `follow_up`)
   so a new `control-request-recorded` (new `requestId`, new correlation) is created.
3. Verify the re-issued leg (see §3.4).

### Outcome B — abandoned request

1. **Do not try to resolve it.** `CONTROL_REQUEST_ABANDONED` is terminal; retrying only adds noise.
2. **Re-issue the ask.** A new ask is a **new** request (`requestId`, correlation, `requestToken`),
   never the old one retried.
3. Optionally record why the original invocation is dead in the incident note, citing the
   `control-request-abandoned` sequence and reason.

### 3.4 Verify the re-issued leg

Check, in order, on the public ledger page for the Team root:

| Step | Row you must see |
| --- | --- |
| the ask is newly minted | a **new** `control-request-recorded` with a new `requestId` (old one absent from the pending list) |
| it reaches the reviewer | a review wake / its turn in the reviewer session (or `team_list_pending_control` lists the new id) |
| it is decided | `control-decision-recorded` with the new `requestId` |
| an allow is spent | `control-allow-consumed` with the new `requestId` |
| it ran | `control-execution-result` (`succeeded` / `failed`) with the new `requestId` |

A re-issued leg that stops before the consumption row is a **new** incident; do not "fix" it by
re-resolving the old request.

> **2026-11-13 correction (append-only; the table above is kept exactly as written).** The middle row
> is **wrong after a cold boot**. Measured on a real Host (SIGKILL with a review-wake turn open and its
> wake-intent row live, then a create-or-open restart; evidence
> `dev/agent-workflow/evidence/a6-cold-wake-20261113/README.md`, register **PD-44 `COLD-WAKE`**):
> a **new** ask minted *after* the restart — never claimed by the dead process — is durably `pending`
> and readable by id, but **no `[team-review-wake]` names it** (45 s observation, wake-intent directory
> empty), `team_follow_up` on the crashed Member is **admitted** (`status 200`, no refusal) and starts
> **no** Officer turn, and **only** `team.resolveControl` ends it (`decidedBy: operator`). Two clean
> reproductions (45 157 ms / 45 160 ms); two controls where no wake row was live at the kill got the
> **Officer** to decide in 251 ms / 252 ms. The discriminator is exactly "a live wake-intent row at
> the kill". **So, today, after a cold boot:** expect no wake and no reviewer turn; the leg is
> `pending` and resolvable, and the `team_list_pending_control` clause is the **only** one that holds.
> **Do not wait for a wake that never comes.**
>
> Why (four layers, each believing it is healthy, all `file:line`):
> (1) `packages/runtime/alpha6/wake-intent.ts:144` — boot **adopts** the persisted row as `queued` and
> emits no delivery effect; (2) `packages/runtime/review-wake/coordinator.ts:300-302` — a
> changed-fingerprint `scan-result` on `queued` only moves the baseline ("it survives a work change and
> the turn re-reads authority itself"), so no `deliver-wake`; (3) `packages/runtime/alpha6/wake-dispatch.ts:370-372`
> — that latch is released **only** when `inbox.has(queuedWakeId)` is false, and the crashed turn's
> message is still listed (`has` answers presence, not liveness), so "No second delivery" with no
> failure and no fact; (4) `packages/runtime/src/plugin/root.ts:2701-2708` and `:2717` — the claim
> event already fired pre-crash, and `turn-end` returns early for `queued`, so the post-turn rescan
> never re-reads the ledger.
>
> **This is a disclosed experimental limit, deferred (owner ruling 2026-11-13), not a step you can
> work around.** The fix requires an **ARC-A centre-interface override** on
> `packages/runtime/src/plugin/live/agent-bindings.mjs` (re-driving a restored invocation for a new
> pending leg) **plus** its own crash-semantics review; neither is in this Preview's scope. Tracked as
> **PD-44**; two narrower re-arm patches were measured and falsified (register row and evidence README
> §6 record them), so do not expect a one-line fix. **Operator action: go straight to
> `team_list_pending_control` + `team_resolve_control`.**

> **2026-11-13 boundary note (append-only, same day; issue #756).** The sentence "the
> `team_list_pending_control` clause is the **only** one that holds" holds **only for a Leader reading
> a `leader-approval` ask**. The list is still Leader-gated (`TEAM_TOOL_PENDING_LIST_NOT_LEADER`,
> checked before any read) and still returns `leader-approval` only. Consequences after a cold boot:
> an **Officer cannot discover its own pending ask** through the list, and a `user-approval` leg is
> **invisible here** (that kind is not listed; the GUI is its check surface). Resolver authority is by
> **scope** — the reviewer instance assigned to the ask's scope may decide it, and the ban is the
> executor deciding its own operation, not "any member" — but the role-granted list redesign that
> would make discovery match that rule is **registered in #756, not implemented**. The operator
> remedy therefore still requires the **Leader** (or the human, off this list, for `user-approval`);
> do not read this runbook as promising that a non-Leader reviewer can find the leg by listing.

---

## 4. What NOT to do

- **Do not** call `team_resolve_control` on an abandoned request, and do not read its refusal as a
  transient failure. `CONTROL_REQUEST_ABANDONED` is a terminal answer, not retryable.
- **Do not** restart the Host again hoping for redelivery. Measured: the restart clears the wake
  intent row (`1 → 0`) and starts **no** wake turn. A second restart only turns "stranded" into
  "stranded later".
- **Do not** treat `pendingControlCount: 0` as proof that no request existed. The count is
  live-undecided only; an abandoned request is deliberately excluded while remaining readable by id.
- **Do not** edit `team_domain.json`, the ledger, or the intent directory to "un-abandon" a request.
  The ledger is the authority; a hand edit creates a state no boot will ever reproduce.
- **Do not** reuse the old correlation / `requestToken` to make the old invocation run again. The old
  invocation is dead by design; a re-issue is a new ask.

---

## 5. Measured row shapes — 2026-11-12, tree `84baf304c`

Both window runs agree field by field (`compare-two-runs.mjs` in the evidence directory):

| field | run-1 | run-2 |
| --- | --- | --- |
| window | `ACCEPTED-not-CLAIMED` | `ACCEPTED-not-CLAIMED` |
| busy-seen / accepted row | `true` / `review-wake:…:a6wake%3Av1%3A1%3Acb2051d4` | `true` / `…%3A524f7a01` |
| wake intent rows (before → after restart → after drain) | `1 → 0 → 0` | `1 → 0 → 0` |
| wake turns before kill / claimed after restart / duplicates | `0` / `0` / `0` | `0` / `0` / `0` |
| pending before / at restart (pre-recovery) | `1` / `1` | `1` / `1` |
| durable `control-request-recorded` / decision / abandoned / consumed / execution-result | `1 / 0→1 / 0 / 0 / 0` | `1 / 0→1 / 0 / 0 / 0` |
| `pendingControlCount` at restart | `1` | `1` |
| request visible by id | `true` | `true` |
| operator `team.resolveControl` (allow) | `200`, decision `allow`, decider `human` | `200`, decision `allow`, decider `human` |
| verdict | `stranded-discoverable` (PASS) | `stranded-discoverable` (PASS) |

Exact rows from run-1 (`storages/team_domain.json`, `tests/homes/c1-smoke-2026-11-12T15-27-14/`):

```text
7  control-request-recorded  ctrl-154qf5f1dlcvt00vmsenl0bp  parameter-permission  bash  allow
8  control-decision-recorded ctrl-154qf5f1dlcvt00vmsenl0bp  allow  decider=human (operator recovery)
   (no control-request-abandoned, no control-allow-consumed, no control-execution-result)
```

Terminal-abandonment trigger (run-3, `C1_A6_CRASH=allow`; `team-tool-execute` / `pa:` lane):

```text
10 control-request-recorded  ctrl-1yitkxs062hys305s2uga0a9  team-tool-execute  pa:…  allow
11 control-decision-recorded ctrl-1yitkxs062hys305s2uga0a9  allow
   (kill before consumption; restart on the same DSH_HOME)
14 control-request-abandoned ctrl-1yitkxs062hys305s2uga0a9  reason=invocation-abandoned
   consumptions=0  executionResults=0  revived=false
```

## 6. Evidence and related pages

- This window, two runs + comparator: `dev/agent-workflow/evidence/pd39-inbox-window-20261112/`
  (`README.md`, `run-1/`, `run-2/`, `run-3-crash-after-allow/`, `compare-two-runs.mjs`).
- Terminal abandonment procedure (the Outcome B path, plus the ledger read): 
  [RUNBOOK-CONTROL-ABANDONED.md](../plans/active/alpha5-sandbox-first/RUNBOOK-CONTROL-ABANDONED.md).
- Release notes, the narrowed promise: [RELEASE-NOTES-0.1.6.md §5](../plans/active/alpha5-sandbox-first/RELEASE-NOTES-0.1.6.md).
- Debt register row: [PRODUCT-DEBT-REGISTER.md PD-39](../plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md).
- The host-free pins: `packages/tools/test/c1-list-pending-control.test.ts` case 11 (the abandoned
  request is not listed; the tool description names the terminal exclusion + ledger lookup),
  `packages/runtime/test/remote-control-abandoned-code.test.ts` (the refusal is typed), and
  `packages/runtime/test/a4p3-intervention-projection.test.ts` (`pendingControlCount` excludes an
  abandoned request).
