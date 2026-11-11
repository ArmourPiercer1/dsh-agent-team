AUDIT-B-ALPHA6

# AUDIT-B — the Alpha.6 approval lifecycle: routing → wake → decision → execution → recovery

**Lane** audit B of four. **Base** `origin/master` @ `9e1c493b6` (`WP2-A6-GOVERNED-GOAL`).
**Worktree** `.worktrees/audit-b`, branch `task/audit-b-alpha6-20261111`.
**Mode** READ-ONLY on product code. No Host boot, no product commit, no merge, no product PR.
**Written file** this report only.
**Method** source read + committed evidence read. Where I wanted a measurement I cite the lane that made it;
I did not re-run any Host. Every line number below is the line in *this* tree (`9e1c493b6`) — where a
document's anchor has drifted I say so.

---

## 0. Verdicts in one screen

| # | Question | Verdict |
|---|---|---|
| **F-3** | Does the Alpha.5 `parameter-permission` ask reach the Officer? | **No — real, and structural.** It is routed to the **Leader** by an explicit carve-out, `notifier.ts:177-186`. Missing on the leg: `blueprintContentHash`, `blueprintRevision`, `operationToolOwner`, `operationToolName` (route/wake gate) **plus** `operationOwnerTemplateId`, `operationToolDefinitionIdentity`, frozen `authorityGeneration` (decision gate). **Not a one-field fix; not a code bug either — see §1.** |
| Q1 | Request types / deciders | Three closed `kind`s, **seven** concrete ask producers, and the Officer path open in exactly **one** of them. Table §2. |
| Q2 | Which kinds carry Blueprint identity | Only the PA-plane leg (`team-tool-execute`). Everything else fails closed. Table §3. |
| Q3 | Review wake | Single-flight latch over `(root, reviewer, generation)`; **four coordinator-registration sites in three roles** (dispatch, human resume, boot recovery from a durable intent/stopped row) — PD-40 holds. §4. |
| Q4 | allow → body | One per-team lock, six durable writers, a documented total order, and **one real hole**: the permission lane writes *no* execution fact, so "ran" vs "refused at dispatch" is unprovable on that lane. §5. |
| Q5 | deny / cancel | Deny terminates with zero consumption and zero side effect; the fence exists where the docs say (`service.ts:4428`) and is wired on all three lanes; three cancel windows, only the first two are safe by construction, the third is disclosed and not reachable by a Stop. §6. |
| Q6 | Cold recovery | Nothing is ever re-executed. Adopt (intent + Inbox truth), refuse (stale/foreign/decided/consumed), or abandon (PA rows only) — the acknowledging code is `resolveControl` + `guardOperation` + `recordExecutionResult`, not the recovery loop. §7. |
| Q7 | Docs vs code | **One P1 doc-integrity defect**: commit `8ebb68b6f` ("disclose F-1/F-4 … registered as PD-42/PD-41") adds *one line*, changes a PD-20 anchor, and neither `PD-41`/`PD-42` rows nor §4.8/§4.9 exist. Plus seven smaller imprecisions. §8. |

**The single most important sentence in this report:** the product *knowingly* keeps the Alpha.5
permission ask on the Leader path and says so in a comment — `notifier.ts:174-179`
("A LEGACY row whose OWN durable authority is the Leader (the parameter-permission ask carries no
Alpha.6 ordinary-tool facts) is legally the Leader's to settle"). F-3 is therefore **an undisclosed
scope decision, not a broken hop**. The defect is in the disclosure, not in the routing.

---

## 1. F-3 — verdict, and exactly what is missing

### 1.1 The reported claim

`dev/agent-workflow/evidence/v016-packaged-acceptance/README.md:183`:

> F-3: … the pre-execute adapter builds its case leg without `blueprintContentHash`/`blueprintRevision`
> (`pre-execute-adapter.ts:1905` → `control/service.ts:5590`), so `resolveAssignedOfficer` refuses it and
> the wake goes to the Leader.

Both anchors are exact in this tree: `packages/runtime/operation-permission/pre-execute-adapter.ts:1905`
(`controlService.requestApprovalLeg({`) and `packages/runtime/control/service.ts:5590`.

### 1.2 It is real — three independent confirmations

1. **Call site.** The adapter's `requestApprovalLeg` call (1905-1930) passes `identity`
   (`subject`, `beneficiary`, `requestedEffect: 'allow'`, `operationFingerprint`,
   `authorityScope: authorityPointOf(operation)`, `correlation` = callId) and **nothing else**.
   `blueprintContentHash` / `blueprintRevision` / `operationOwnerTemplateId` / `operationTool*` /
   `authorityGeneration` are all declared `?:` on the signature (`service.ts:5606-5612`) and none is passed.
2. **No slot upstream either.** `InstallParameterPermissionListenerParams`
   (`pre-execute-adapter.ts:528`) has no blueprint-identity field, and the production install site
   (`src/plugin/live/agent-bindings.mjs:3983`, inside the live wiring) passes no blueprint identity —
   unlike the PA plane, which is fed `blueprintContentHash`/`blueprintRevision` at
   `agent-bindings.mjs:3215-3227`. So even a "just thread the hash through" patch has no wire today.
3. **Observed in a live run.** `dev/agent-workflow/evidence/wp1-sticky-stop/README.md:44` describes the
   same run producing *two* legs for one bash ask: "a `parameter-permission` leg (Leader) and its
   allowed PA leg (`team-tool-execute`, operation-tool facts) routed to the Officer". One ask, two
   deciders — the mechanism F-3 describes, measured.

### 1.3 The exact missing identity, by gate

`resolveAssignedOfficer` is the shared gate of **both** faces of the facts port
(`packages/runtime/alpha6/assigned-officer-facts.ts:337-404`). Two different callers ask two different
things of it:

* **(A) the route/wake gate** — `root-router.ts:145-184` `legFactsOf()` builds `ordinaryAsk` only when
  `kind==='leader-approval' && reviewAuthority==='leader' && requestedEffect!==undefined &&
  operationToolOwner!==undefined && operationToolName!==undefined && authorityScope!==null`.
  If `ordinaryAsk` is `null`, `routeReview` falls through every arm to
  `{kind:'unroutable', reason:'current leg is not a delegable ordinary tool ask'}`
  (`packages/runtime/review-router/router.ts` final fallback).
* **(B) the decision/escalation gate** — `reviewCallFacts()` (`assigned-officer-facts.ts:413-482`)
  additionally demands the OperationOwner, a frozen **and** current `authorityGeneration`, and the three
  frozen tool-binding fields.

**Gate A — exactly four fields are missing on a `parameter-permission` leg:**

| Field | Wanted at | Present on the permission leg? | Why it cannot simply be added |
|---|---|---|---|
| `blueprintContentHash` | `assigned-officer-facts.ts:371` | ✗ (`undefined`; row exists, field never written) | available in the composition, but no parameter slot on `InstallParameterPermissionListenerParams` (`:528`) |
| `blueprintRevision` | `:372` | ✗ same | same |
| `operationToolOwner` | `root-router.ts:162` | ✗ | a builtin-tool parameter ask has **no tool-governance ToolBinding**; inventing an owner would be the invented-authority case the ADR §2b forbids |
| `operationToolName` | `root-router.ts:163` | ✗ | the row's `toolName` is a *different* field (`ControlRequestRecord.toolName`); `legFactsOf` reads `operationToolName` |

**Gate B — three more, all structurally absent:** `operationOwnerTemplateId` (`:426`),
`operationToolDefinitionIdentity` (`:449`), and the frozen `authorityGeneration` (`:433`, compared
against the current owner generation resolved at `:427-432`). The permission leg *does* carry the
OperationOwner instance (`identity.subject` is an instance; `:423` with the helper at `:312-315`
derives it correctly) — so the owner is knowable, but its **template**, its **generation** and the
**tool binding** are not.

### 1.4 One-field fix, or seam change?

**Neither.** The honest options are:

* **Option D (docs, zero code — recommended).** Declare the Alpha.5 permission lane outside the Alpha.6
  Officer plane, once, in `ADR-alpha6-review-capability-20261103.md` §2b and in
  `RELEASE-NOTES-0.1.6.md` §2.2. The code already implements exactly this and documents it in
  `notifier.ts:174-179`. Cost: one paragraph. Risk: none. F-3 is a **capability** gap, never a safety
  gap — the fail-closed direction is preserved (no widening, no authority confusion, no impersonation).
* **Option S (seam change, ~8 fields, 3-4 files + an ADR amendment).** Add a trusted builtin-tool
  identity source to the composition, add the fields to `InstallParameterPermissionListenerParams`,
  thread them from `agent-bindings.mjs:3983`, pass them at `pre-execute-adapter.ts:1905`, widen the
  ADR's closed delegable set to admit builtin-tool asks, and accept that **every bash parameter ask in
  an opted-in Team then goes to the Officer**. That is a product-behaviour change far larger than the
  gap it closes, and it moves the Officer onto the highest-volume ask in the system.

A "one-field fix" does not exist: adding only the two Blueprint fields leaves gate A closed on
`operationToolOwner`/`operationToolName`, so the route stays `unroutable` and the notifier still takes
the Leader carve-out. Adding all four without the ADR amendment would delegate asks whose tool the
blueprint never declared — the failure mode the ADR's closed set exists to prevent.

**Classification: P1, docs/contract (routing completeness). Not P0.**

---

## 2. Q1 — every approval request type, and who actually decides it

### 2.1 The closed sets (unchanged, verified)

`packages/runtime/control/types.ts:160-176` — `CONTROL_REQUEST_KINDS = ['leader-approval',
'user-approval', 'envelope-mutation']`; decisions `['allow','deny','stale-denied']`;
`types.ts:194-198` — `CONTROL_RESOLVER_ROLES`: `leader-approval → ['leader','human']`,
`user-approval → ['human']`, `envelope-mutation → ['leader','human']`. The client mirrors the same map
(`packages/client/src/model/control-surface.ts:39-41`). A member is never a resolver by table; the only
member path is the delegated Officer capability (`service.ts:3246-3271`).

### 2.2 Producers — seven, not three

| # | Producer | `actionName` | `kind` | Carrier | Decider (contract) | Decider (what actually happens) |
|---|---|---|---|---|---|---|
| 1 | `team_request_control` (model tool) | caller-supplied | any of 3 | legacy row, no case | per kind table | Leader / Human. Never Officer (no case identity → `notifier.ts:150-160` Leader path) |
| 2 | Alpha.5 pre-execute adapter, **v3+ arm** | `parameter-permission` (`:731`) | `approvalRouting.carrierKind` — `leader-approval` for a Leader rung, `user-approval` for a Human rung (`approval-routing.ts:20-24,485`) | **case leg** (`:1905`) | Leader / Human | **Leader** for the ordinary rung (F-3); Human for the Human rung. Officer never sees either |
| 3 | Alpha.5 pre-execute adapter, **pre-v3 arm** | `parameter-permission` | same | legacy `requestControl` (`:1948`) | Leader | Leader (no case, no route) |
| 4 | PTC escalation row (Host `approval/request` sandbox escalation → Team ask) | `parameter-permission` (`ptc-escalation-row.mjs:84`) | `leader-approval` (member) / `user-approval` (leader) (`:410`) | legacy row, **no case id** (`:407-418`) | Leader / Human | Leader / Human — structurally un-delegable |
| 5 | PA control bridge (governed team-tool execution) | `team-tool-execute` (`:313`) | `leader-approval` | **case leg** (`:464`) with full frozen identity | Officer when facts resolve | **Officer** in an opted-in v5 Team (`A6-2 wakes=3 requests=16`, `c2-adjudication-2/README.md` §3); Leader via the transfer / `whenOfficerUnavailable: leader` / Leader-exception arms; a `hold` (not a Leader wake) when the Officer state cannot be resolved — see P1-3 |
| 6 | Governance permission mutation | `` `permission-mutation:${perm.kind}` `` (`governance/service.ts:1011-1023`) | `envelope-mutation` | legacy row + `buildPermissionMutationApprovalIdentity` | Leader or Human | Leader / Human. Never Officer (`createAlpha6CategoryLookup` returns `true` → fixed category) |
| 7 | Recovery dispatch | `recovery:<token>:<attempt>` (`action-router/router.ts:516`) | `user-approval` | row with `reviewPayload`, `executionCoupling: INLINE` | Human | Human only |

**Out of scope by construction:** upstream Host-native approval prompts that the PTC row does not
convert (e.g. a non-Team sandbox escalation). Those never enter the Team control ledger and are not
part of this lifecycle.

### 2.3 Where every decision is written

Always `ControlService.resolveControl` (`service.ts:3165`), under `withTeamLock(teamLocks, root, …)`
(`:3203`), in this order: abandonment check (`:3215`) → decided check (`:3227`) → role closure (`:3235`)
→ delegated-Officer evaluation (`:3246-3266`, requires `assignedOfficer === true` **and** the trusted
ports) → earlier-leg exclusion (`:3296`) → envelope (`:3305`) → resolve-time staleness (`:3313-3340`) →
`commitDecision` with `reviewCapability` attached when delegated (`:3454`). The `assignedOfficer` flag
itself is set by the tool layer for *any* non-Leader instance caller (`packages/tools/src/tools.ts:1098-1112`)
and is only a request to evaluate the delegated path — it grants nothing.

Escalation has its own entrance (`escalateApprovalLeg`, `service.ts:5775`+, same shape at `:5849-5860`)
but writes the same case law.

---

## 3. Q2 — which request kinds carry Blueprint identity today

Requirement (from the facts-port header, `assigned-officer-facts.ts:1-60`): root, `reviewRouting.enabled`,
durable pending leg matching case/request/ordinal/kind/rung, **exact `blueprintContentHash` +
`blueprintRevision`**, no current-leg transfer, exactly one live Officer, frozen `authorityGeneration`,
OperationOwner resolving to a live member of the leg's template, complete frozen tool binding, fixed
category answer.

| Carrier | hash + revision | owner template | tool definition/owner/name | generation | Gate A | Gate B |
|---|---|---|---|---|---|---|
| `team-tool-execute` leg (`pa-control-bridge.ts:464-505`) | ✓ passed (`:488-499`) | ✓ | ✓ (`request.binding.definitionIdentity`) | ✓ (`plan.authorityGeneration`) | **open** | **open** |
| `parameter-permission` leg (`pre-execute-adapter.ts:1905`) | ✗ | ✗ | ✗ | ✗ | closed | closed |
| `permission-mutation` row (`governance/service.ts:1011`) | ✗ | ✗ | ✗ | ✗ | n/a (kind) | n/a |
| `team_request_control` rows (`tools.ts:1015`) | ✗ | ✗ | ✗ | ✗ | n/a (no case) | n/a |
| PTC escalation rows (`ptc-escalation-row.mjs:407`) | ✗ | ✗ | ✗ | ✗ | n/a (no case) | n/a |
| recovery `user-approval` (`action-router/router.ts:516`) | ✗ | ✗ | ✗ | ✗ | n/a (kind) | n/a |

**Reported F-3: CONFIRMED**, with a precision the report in `v016` does not have: the Blueprint hash is
*one of four* fields missing for the wake gate and *one of seven* for the decision gate (§1.3). Adding
the hash alone changes nothing observable.

Also confirmed and worth naming: **F-5** (an Officer's `team_resolve_control{escalate}` on a PA leg
refused with "the trusted review-facts port produced no facts for this leg",
`v016-packaged-acceptance/README.md` §6) is *not* a second F-3 — it is gate B refusing for a
`team-tool-execute` leg whose owner/generation/binding facts did not line up at that moment. The facts
port is a long chain of sequential refusal arms (`assigned-officer-facts.ts:337-482`); any one of them turns
"Officer decides" into "nobody can decide this leg as an officer", and the resulting error is a typed
`CONTROL_RESOLVER_NOT_AUTHORIZED`, which is fail-closed but makes the Officer hop a *conditional*
property, not a stable one.

---

## 4. Q3 — the review wake

### 4.1 Creation

`ControlService.requestControl` notifies through the `requestNotification` port **only for
`leader-approval`** (`service.ts:2864-2877`; the port is wired at `root.ts:3135-3160`, passed to the service at `:3205`). Therefore:

* a `leader-approval` ask (permission leg, PA leg, `team_request_control`, PTC row) gets a wake;
* a `user-approval` or `envelope-mutation` ask **never** gets a wake — it is only discoverable in the
  projection/pending list. That is a coverage fact the notes do not state.

The composed notifier (`packages/runtime/alpha6/notifier.ts:116-200`) then:

1. case-less `leader-approval` → `notifyLeader` (`:150-160`);
2. `route(requestId, root)` via `createAlpha6RootRouter` (`root.ts:3139-3148`) → the pure `routeReview`;
3. `no-work` → nothing; `unroutable`/`hold` → the **legacy-Leader carve-out** (`:177-186`) or a thrown
   refusal; `native-human` → nothing; `routeRole==='leader'` → `notifyLeader`; else `deliverOfficerWake`.

### 4.2 Merge

`collectAlpha6DelegableLegs` (`notifier.ts:313-360`) merges the Team's pending `leader-approval` case
legs per recipient (matching case + ordinal, same reviewer, seed included verbatim). **`planReviewWakes`
(`alpha6/wake-plan.ts`) is not used in production** — its module doc claims the per-request notifier is
"NOT the main path", which is backwards; production uses exactly that notifier plus
`collectAlpha6DelegableLegs`, and `planReviewWakes` appears only in tests. (Doc mismatch D8.)

### 4.3 Delivery

`deliverReviewWake` (`agent-bindings.mjs:6065-6100`): `createUserMessage` with
`source: {kind:'plugin:dsh-agent-team'}` and the rendered text from `renderOfficerReviewWake`
(`notifier.ts`), delivered as `followup` when the reviewer is idle and `steer` when busy. The rendered
text carries `[team-review-wake …]` and the wake id.

### 4.4 The store

* **Intent rows** `wake-<hash>.json` in `config.alpha6WakeIntentPath`
  (`alpha6/wake-intent-store.ts` — atomic temp+rename, per-file mutation gate;
  `alpha6/wake-intent-directory.ts` — `pathFor`, `list`).
* **Stop markers** `stopped-<hash>.json` in the same directory (`wake-intent-directory.ts`
  `markStopped`/`clearStopped`/`isStopped`/`listStopped`).
* **Native DSH Inbox is delivery truth** — the store only records "we decided to deliver" and "the Inbox
  accepted it".

### 4.5 What makes a latch exist

A `LatchCoordinator` in `alpha6WakeBySession` / `alpha6WakeCoordinators` (`root.ts:2553-2554`).
**Only four `alpha6WakeBySession.set` sites exist, in three roles**
(`grep -n 'alpha6WakeBySession.set' packages/runtime/src/plugin/root.ts`):

1. **dispatch** — `alpha6DispatchWake` / boot rebuild (`root.ts:2579-2612`, `set` at `:2608`);
2. **human resume** — `alpha6WakeUserResume` (`root.ts:2793-2835`, `set` at `:2809`);
3. **boot recovery** — the stopped-marker loop (`:2935-2951`, registers the latch as *stopped* so a
   later explicit resume can find it) and the intent loop (`:2953-3035`, adopts per row through
   `recoverReviewWake`).

Nothing creates a coordinator for "every live reviewer at boot". That is precisely why **PD-40** holds:
a human Stop issued when no latch exists finds `coordinator === undefined`, returns `false` before any
write (`root.ts:2764-2770`), and a later wake activates the reviewer again.

### 4.6 What consumes an intent

The Host's own inbox events drive it — no polling loop:

* **claim** — `onHostEvent('agent/inbox/claimed')` (`host.ts:3051-3062`) fires only for a message whose
  text contains the wake marker, then `alpha6TurnLatchStart` → `claimReviewWake` (`wake-dispatch.ts`),
  which moves `queued → running` at `turn-start` and writes nothing else;
* **release** — `onHostEvent('agent/status')` with `status==='idle'` (`host.ts:3065-3072`) →
  `alpha6TurnLatchEnd` → `releaseReviewWake`, which claims-if-still-queued, runs
  **one** post-turn `scan-result` re-read, then drains the deliver/withdraw effects. A new fingerprint ⇒
  exactly one new delivery; `no-ready-work` ⇒ withdraw + `clear`.
* Delivery failure releases back to `queued`; the intent row is deleted only on withdraw or release
  failure, never on claim (it is the single-flight heartbeat, not a queue item).

The laws are stated and tested in `packages/runtime/review-wake/coordinator.ts` (single flight, one
post-turn re-read, pending ≠ changed, no-progress guard, "recovery adopts, never re-delivers", Sticky
Stop suspends until explicit resume).

### 4.7 Sticky Stop

Producer: `session/event` `turn/end` with `reason.kind==='aborted' && reason.reason.kind==='user'`
(`host.ts:3097-3110`; listener registered only when the opt-in composed — `:3085-3095`). Handler:
`alpha6WakeUserStop` (`root.ts:2764-2791`): no coordinator ⇒ `return false`; else `markStopped`.
Resume: an explicit human message to the stopped reviewer (`alpha6WakeUserResume`, `:2793-2835`) clears
the marker and re-marks it on the *new* generation (`:2818`).

### 4.8 Restart

`alpha6RecoverWakeLatches` (`root.ts:2846-3100`, invoked from `host.ts:3389`):

1. **settlement** (Scheme A, `:2859-2925`, first, before any latch is rebuilt) — for PA rows only
   (`ownerRootSessionId === rootSid`, correlation `pa:` or `actionName === 'team-tool-execute'`), a
   durable `allow`, consumed without a result ⇒ `recordExecutionResult({outcome:'unknown'})`;
   unconsumed and still pending ⇒ `abandonControlRequest` (`invocation-abandoned` /
   `execution-outcome-unknown`);
2. **stopped markers** (`:2935-2951`) — owner-guarded (`ownerRootSessionId === rootSid`, legacy rows fall
   back to the strict own-root), generation-matched, and registered as a *stopped* latch so the Stop
   survives; a stale-generation marker is skipped, and another mount's marker is never ours;
3. **intent rows** (`:2953-3035` + `recoverReviewWake`, `wake-intent.ts`) — owner- and
   generation-guarded; a stale generation is *withdrawn* (Inbox `remove`, then `clear` only when the
   Inbox positively confirms absence — an unreadable probe keeps the row for the next boot); a live row
   is adopted **only if its Inbox message still exists**; the recovery fact is always persisted as
   `queued`, never `running`;
4. **refusals before any of this**: missing `live.deliverReviewWake` (`root.ts:2507`), missing absolute
   intent path (`:2536`), missing `live.reviewWakeInbox` (`:2545`), refused composition (`:2492`).

The order matters and is deliberate: settlement runs first so that a dead invocation is closed *before*
its latch could be re-adopted and re-delivered.

---

## 5. Q4 — the full chain from a human `allow` to the tool body running

### 5.1 The lifecycle table

| # | Stage | Writer (file:line) | Durable fact | Failure mode | Evidence |
|---|---|---|---|---|---|
| 1 | Ask raised | `pre-execute-adapter.ts:1905` / `pa-control-bridge.ts:464` → `service.ts:5590` → `requestControl:2472` | `control-request-recorded` (`FACT_REQUEST`, `:316`) | typed `ControlError`; no row, nothing to decide | `v016` §5; `wp1` §3 |
| 2 | Wake | `notifier.ts:116-200` → `agent-bindings.mjs:6065`; intent row via `wake-intent-store.ts` | `wake-<hash>.json` (`queued`→`accepted`) + Inbox message | throw ⇒ `onNotificationFailure` only; the ask stays durable but only in the pending list | `A6-2 wakes=3` |
| 3 | Claim | `host.ts:3051-3062` → `claimReviewWake` | none durable (in-memory latch `running`) | crash ⇒ intent stays `queued`; boot re-adopts | `A6-25` PASS |
| 4 | Decision | `resolveControl:3165`, `commitDecision` | `control-decision-recorded` (`:318`) + `reviewCapability` (`:3454`) | abandoned/decided/role/capability/staleness refusals — all zero-write | `A6-2`, `A6-9` |
| 5 | Consumption | `guardOperation`, sequence `:4414`, fence `:4428`, write `:4435` | `control-allow-consumed` (`:320`) | abandon / deny / `ALLOW_CONSUMED` (`:4281`) / scope mismatch / `CONTROL_GUARD_AMBIGUOUS` (`:4299`) | `A6-9`, `WP3` |
| 6 | Dispatch binding verification | `tool-dispatch/closed-world-guard.ts:199` | **none** (refusal only) | `BINDING_UNVERIFIED` ⇒ no body runs, **consumption already durable** (F-4 / PD-41) | `v016` §6 F-4 |
| 7 | Execution | the tool body | none by itself | throw ⇒ `failed` | `A6-27` |
| 8 | Execution fact | `a5p5-tools/src/pipeline.ts:186-196` → `agent-bindings.mjs:3234-3235` → `recordExecutionResult:3561` | `control-execution-result` (`:324`) | **absent on the permission lane** (§5.3) | `A6-27 outcome=succeeded facts=1`; `A6-28 execFacts=0` |
| 9 | Abandonment (any time) | `commitAbandonmentFact:3477` via `:4209` (fence), `:2916/:2920` (boot), `:3404/:3431` (undetermined allow), `:3606` (API), `:4619` (inline cascade) | `control-request-abandoned` (`:323`) | terminal; never becomes an allow | `A6-26`, `WP3` |

### 5.2 The ordering guarantee, stated exactly

Everything from "load state" to "write the consumption row" happens inside **one** `withTeamLock` hold on
the team root (`guardOperation` takes it at `service.ts:4097`; decisions take it at `:3204`). Inside that hold the guard performs, in
order: abandon check (`:4204-4213`) → decision presence + value (`:4137-4144`) → `stale-denied` block →
`deny` block → resource/scope match → consumed check (`:4270-4282`) → ambiguity check (`:4299`) → PA
manifest / external-policy / authority rechecks → `allocateSequence()` (`:4414`) → **the fence**
(`:4428`) → `putEntry` of the consumption (`:4435`). The fence is therefore *the last synchronous read
before the consumption write*, with exactly one `await` left after it (the write itself). That is the
guarantee the docs claim, and it is true.

What the guarantee does **not** cover:

* it does not cover the dispatch-time binding check (`closed-world-guard.ts:199`), which happens after
  the consumption is durable — that is F-4/PD-41, fail-closed but "consumed and never executed";
* it does not make the consumption + the body atomic (impossible without an upstream seam);
* it does not extend to the permission lane's execution fact, because that lane writes none (§5.3).

### 5.3 The hole I did name: no execution fact on the permission lane

`recordExecutionResult` (`service.ts:3561`) matches the row by `reviewPayload.callId`. Only two callers
exist: the PA plane hook (`agent-bindings.mjs:3234-3235`, fed by `pipeline.ts:186-196`) and boot
settlement (`root.ts:2902-2906`). The `parameter-permission` leg has **no `reviewPayload`** and no installed observer, so
for a permission ask the ledger can end at stage 5 (consumed) and stay there forever — indistinguishable
from "the body ran", "dispatch refused", or "the process died between the two". `A6-27`'s
`outcome=succeeded facts=1` is a PA-plane measurement and does not cover this lane. Consequence: on the
permission lane, "one approval, one execution" is not provable after the fact from the durable record.

### 5.4 What is not re-executed, and why

`guardOperation` refuses a second consumption (`ALLOW_CONSUMED`, `:4281`) and refuses ambiguity when two
unconsumed allows could match (`CONTROL_GUARD_AMBIGUOUS`, `:4299`); `resolveControl` refuses a second
decision (`CONTROL_REQUEST_DECIDED`, `:3227-3235`); `recordExecutionResult` is idempotent per requestId;
`commitAbandonmentFact` is exactly-once. Inline-coupled (`executionCoupling: INLINE`) allows never
consume at all — they are authorized effects, not guards. `stale-denied` is terminal like `deny`.

---

## 6. Q5 — deny, and where cancel lands

### 6.1 Deny

`resolveControl` writes `control-decision-recorded` with `decision:'deny'`; the waiter returns; the
adapter returns `deny` **without calling the guard at all**, so no consumption row and no body. If a
stale wait somehow reaches the guard, the guard re-reads the decision and blocks
(`CONTROL_GUARD_BLOCK_REASONS`, mapping at `:4137-4144`: abandoned → `REQUEST_ABANDONED`, stale →
`REQUEST_STALE`, deny → `DECISION_DENY`). Measured: `A6-28` — deny ⇒ zero consumption, `execFacts=0`
(`c2-adjudication-2/README.md` §3). Also `stale-denied`: terminal, no execution, no re-ask.

### 6.2 Cancel — three windows, and the fence

| Window | What happens | Durable result | Safe? |
|---|---|---|---|
| **Before the fence** (invocation aborted while waiting / between awaits) | wait rejects; the adapter returns; inline coupling runs `inlineAbortCascade` (`:4619`, reason `wait-aborted`, `:363`) | `control-request-abandoned` or nothing consumed | yes — zero consumption, zero side effect |
| **At the fence** (`:4428`) | `guardOptions.signal.aborted === true` ⇒ `commitAbandonmentFact(…, GUARD_CANCELLED_ABANDON_REASON)` (`:375`, `invocation-cancelled-before-consumption`) then `INVOCATION_CANCELLED` | `control-allow-consumed` **not** written; abandon row at its own sequence | yes — measured 0/11 consumed across 29 boots (`wp3-fence-timing/README.md`) |
| **After the consumption write** (`:4435`+) | the approval is spent; the body may still be aborted by the Host | consumption stands | by design — one approval is one execution |

**The `#710` fence exists exactly where the docs claim.** `GUARD_CANCELLED_ABANDON_REASON` at
`service.ts:375`; the probe at `:4428`; the sequence deliberately allocated before it (`:4414`) so the
probe has one `await` left after it; the abandon path allocates its own sequence in the shared
exactly-once writer (so the ledger shows a *gap*, not a phantom consumption).

**Wired on all three lanes** (this is the part most likely to rot, so I checked each):

* A5 permission lane — `pre-execute-adapter.ts:2141` `guardOperation(scope, { signal })`;
* PA lane — `pa-control-bridge.ts:556-568` builds one `AbortSignal.any([wait, timeout])` and the
  last-mile guard call at `:721-724` passes it as the optional second argument;
* team-tool lane — `packages/tools/src/guard.ts:86` forwards `options`, and
  `packages/tools/src/tools.ts:354-364` builds `{ signal: ctx.signal }`.

**Residual, disclosed:** 0.3–0.6 ms between the probe and the write (poll cadence 250 ms, 11/29 boots
hit the fence). Within that window a Stop does not prevent the consumption (it prevents nothing that was
already written). The docs say so (`RELEASE-NOTES-0.1.6.md` §8, `wp3` §5) and it is not fixable without
an upstream seam.

### 6.3 One asymmetry worth naming

A Stop that trips the fence leaves the human's `allow` **as written** and adds an *abandon*. So the
ledger shows "allowed, never consumed, abandoned" — which is correct, and it makes the Stop auditable as
a *lifecycle* event rather than an approver's deny. The asymmetry: a raw ledger scan sees an `allow` with
no consumption and no execution result, which reads like "about to run", while the same row is
lifecycle-terminal. `pendingControlCount` excludes both decided and abandoned rows
(`projection-source.ts:906-928`), so the operator-facing count is right and the raw scan is the thing
that misleads.

---

## 7. Q6 — cold recovery: what is replayed, adopted, refused

**Replayed: nothing that executes.** No code path re-issues a tool call, re-consumes an allow, or
re-delivers an already-delivered wake. Recovery can only *adopt* (make a latch exist), *refuse*, or
*abandon*. This is the strongest property in the plane and it holds in both the code and the evidence.

| Object | At boot | Decided by |
|---|---|---|
| wake intent (`wake-*.json`, `queued`/`accepted`) | adopted **iff** the Inbox message still exists and the session generation matches; else discarded and the file pruned | `wake-intent.ts` `recoverReviewWake` + `pruneAbsentReviewWakeRow`; `root.ts:3030-3100` |
| wake latch (in memory) | rebuilt from the adopted intent, or from a stopped marker | `root.ts:2951`, `:3035`; resume from a marker at `:2805-2809` |
| Sticky Stop marker | adopted as a *stopped* latch — the Stop survives, the wake does not activate the reviewer | `wake-intent-directory.ts` `isStopped`/`listStopped`; `root.ts:2935-2951` |
| request row with no decision, no abandonment | **left exactly as is** — nothing at boot touches it (it is not "pending-and-dead"; only PA rows are settled) | `root.ts:2859-2925` scope filter |
| request row with `allow`, consumed, no result (PA only) | `recordExecutionResult({outcome:'unknown'})` | `root.ts:2898-2906` |
| request row with `allow`, not consumed (PA only, invocation dead) | `abandonControlRequest(…, 'invocation-abandoned')` | `root.ts:2914-2921` |
| request row already decided/abandoned/consumed | **refused** for any further action | `resolveControl:3215/3227`, `guardOperation:4204/4270` |
| foreign root / stale generation / unreadable Inbox | **refused** (`agent-bindings.mjs:6015` throws for an unreadable inbox; the boot gate is `root.ts:2535`) | as cited |

**The code that decides "already decided / already consumed"** is not in the recovery loop — it is the
normal-path guards: `resolveControl` (abandonment then decisions, `:3215-3235`) and `guardOperation`
(abandon `:4204-4213`, consumed `:4270-4282`, ambiguous `:4299`). Recovery merely *uses* them. That is
the right factoring: there is exactly one authority for "may this still be decided/consumed" and
recovery cannot mint a second one.

**Recovery's own refusals** are worth naming because they are fail-closed in the strict sense: a PA row
whose owner root does not match is *skipped*, not adopted; a row whose decision is not `allow` is
skipped even if abandoned-looking; a consumed row with a result is skipped. A skipped row can therefore
stay in an odd state forever — that is the residual behind the A6-26 mechanism question (§8 D4).

---

## 8. Q7 — docs vs code

### 8.1 Claims I checked and confirm

`RELEASE-NOTES-0.1.6.md`:

* **§2.2** the opt-in is empty by default (byte-identical Alpha.5 — `createAlpha6RootWiring` returns
  `legacy` **without invoking** the live thunk, `root-composition.ts:188-195`); an opted-in Team refuses
  to boot on a missing wake seam / intent path / inbox (`root.ts:2512/2527/2535`); the intent store is
  audited by the A6-26/25 split; zero-or-two Officers refuses **per query, not at boot**
  (`createAlpha6LiveRootComposition` passes a synthetic single-template list on purpose,
  `root-composition.ts:214-225`, and `officerStateOf` is the real gate, `root-router.ts:106-140`);
  Sticky Stop listeners are unregistered without the opt-in (`host.ts:3085`);
  `plugin:dsh-agent-team` provenance (`agent-bindings.mjs:6065`).
* **§4.7** PD-40's shape: latch-scoped; the coordinator sources it names (dispatch, boot recovery from
  an adopted intent/stopped row) are the load-bearing ones (§4.5); Stop-before-latch writes nothing.
* **§5** A6-26's safety half: no duplicate, no side effect, not decidable afterwards
  (`CONTROL_REQUEST_ABANDONED` at `:3215-3225`), not redelivered.
* **§8** the fence: constant, probe line, reason string, sequence handling, residual window, and the
  three-lane wiring — all as documented.

### 8.2 Defects

**D1 (P1, documentation integrity).** Commit `8ebb68b6f` is titled
`docs: disclose F-1/F-4 from the packaged acceptance (PD-41, PD-42) (#715)` and its body claims "Both are
disclosed in §4.8/§4.9 and registered as PD-42/PD-41 with the measurement, the falsifier and the smallest
honest fix." The commit's entire diff is **one line**: a PD-20 anchor moved from `tools.ts#L1245-L1245`
to `#L1259-L1259`. `PRODUCT-DEBT-REGISTER.md` has **no PD-41 row and no PD-42 row** (its last row is
PD-40), and `RELEASE-NOTES-0.1.6.md` has **no §4.8/§4.9** and does not contain the strings
`memberIoCeilings`, `MEMBER_POLICY_WITHOUT_BLUEPRINT`, `disjoint`, `F-1`, `F-2`, `F-4`, or
"Tool Binding". So F-1 (the two planes are disjoint modes; `memberIoCeilings` is refused on the v5 path,
`product-assembly.ts:728`) and F-4 (a human allow can be consumed with no execution) are **undisclosed in
the artifact's own release notes**, and the two debts the evidence books are unregistered. This is the
single most actionable finding of this audit: the notes' §1 "One artifact carries both planes" is true,
but nothing tells an operator the two planes are mutually exclusive *per Team*, and nothing tells them a
consumed approval may never execute.

**D2 (P1).** F-3 is undisclosed. §2.2/§1 read as if the Officer plane covers team asks generally; the
code keeps the highest-volume ask (every builtin-tool parameter ask) on the Leader path and says so only
in `notifier.ts:174-179`. Fix: one paragraph in the ADR §2b + one sentence in §2.2.

**D3 (P2).** PD-40's text says the only `stopped-*` writer sits at `root.ts:2755-2762`. Actual: the
function starts at `:2764` and the write (`markStopped`) is at `:2770`; there is a **second**
`markStopped` call at `:2818` in `alpha6WakeUserResume` (re-marking an already-stopped latch when a resume
fails to apply — it preserves the existing state, it does not create a new Stop). "The only writer" is
therefore imprecise; the *gate* (`coordinator === undefined` ⇒ `false` before any write, `:2768`) is the
right invariant and the sentence about the writer is not.

**D4 (P2, mechanism unverified).** §5 states that at an accepted-but-unclaimed crash "the durable control
request is marked `control-request-abandoned` with reason `invocation-abandoned`". In `a6-gaps-g2-unclaimed-r11`
the abandoned `team-tool-execute` row (`ctrl-007bq91qmca7m117zpi30ak`) has **no decision of its own**
(ledger seq 10, `run-manifest.json` `optIn.timeoutMs: 0`), yet this tree has exactly three writers of
`invocation-abandoned`: boot settlement (requires a durable `allow` on that request,
`root.ts:2906/2921`), the A6 undetermined-allow path (`service.ts:3402/3429`, requires a resolve), and the
PA bounded-wait expiry (`pa-control-bridge.ts:598-606`, requires `timedOut`, disabled by
`timeoutMs: 0` and by the 600 000 ms default). **None is reachable for that row.** See §10.

**D5 (P2, audit-trail ambiguity).** `A6_UNDETERMINED_ABANDON_REASON = 'invocation-abandoned'`
(`service.ts:367`) reuses the A6-26 **crash** reason string, while the fence deliberately has its own
reason precisely so a Stop "must never read back as `invocation-abandoned`" (`:369-375`). Result: a
crash-abandon and an authority-undetermined abandon are indistinguishable in the durable ledger, even
though the code bothered to separate the third case. One distinct string would fix it.

**D6 (P2).** §4.7's parenthetical — "(a wake was dispatched, or boot recovery adopted an intent/stopped
row)" — is incomplete: `alpha6WakeUserResume` **creates** a coordinator at runtime from a durable stopped
marker when none is registered (`root.ts:2796-2809`). This does not weaken PD-40 (it needs the marker,
which needs a prior latch, which is the very thing PD-40 says may be absent), but the sentence is the
basis of the PD-40 argument and should be exact.

**D7 (P3).** §3.3: a wait timeout "never decides or consumes" — true, but it **abandons** the request
durably (`pa-control-bridge.ts:598-606`). An operator reading the sentence could believe the ask survives
a timeout.

**D8 (P3).** `alpha6/wake-plan.ts` module doc: the per-request notifier is "NOT the main path". Backwards:
production uses `collectAlpha6DelegableLegs` (`root.ts:226`, `notifier.ts:313`); `planReviewWakes` is
test-only.

**D9 (P3).** §8's parenthetical "the fact type is also written by … the inline `abandonControlRequest`
and the A6-26 crash abandon" omits the inline cascade's own reason (`wait-aborted`, `:363`) and the
fence's reason, i.e. the vocabulary is four strings, not two.

**D10 (P3).** `alpha6/composition.ts` header says a zero-or-multiple Officer situation refuses *at boot*
("exactly ONE live instance"). Production deliberately does not: `createAlpha6LiveRootComposition`
(`:214-225`) feeds a synthetic `[officerTemplateId]` list to the static decision so boot only validates
the declaration, and the per-query law is `officerStateOf`. The release notes are right; the module
header is stale.

**D11 (P2, brief vs tree).** The audit brief names `dev/agent-workflow/evidence/pd42-v5-cellings/` as a
key evidence tree. It **does not exist on this base**: it lives only on
`task/pd42-v5-cellings-20261111` (commits `bf73378db`, `04f6a8ea6`), and PD-41's tree only on
`task/pd41-allow-semantics-20261111`. Neither is an ancestor of `origin/master`. Every F-1/F-4 statement
in this report is therefore taken from the `v016-packaged-acceptance` README plus the code, not from that
tree.

### 8.3 Anchor drift (non-defects, recorded so nobody re-derives them)

* `product-assembly.ts` `derivedMembersOf` refusal: evidence cites `:724`, actual `:728`.
* PD-40's `root.ts` anchor: evidence/docs cite `:2755-2762`, actual gate `:2768`, write `:2770`.
* PD-20's anchor was the only thing `8ebb68b6f` actually changed (`tools.ts#L1259-L1259`), and that
  anchor is **correct** in this tree: the string `NEXT tool boundary is refused` is at `tools.ts:1259`.
  So the commit did three things: a correct anchor move, and two claims it did not implement.

---

## 9. P0/P1 candidates

No **P0** found. The plane is fail-closed at every gate I could reach: an unproven delegation becomes a
typed refusal, never a widened authority; an undecidable request becomes an abandon, never an
execution; a second execution is blocked by the ledger.

### P1-1 — F-3 is undisclosed and the contract does not say which plane owns the permission ask
*Evidence*: §1; `notifier.ts:174-179`; `wp1` §3; `v016` §6.
*Why P1*: an operator reading the notes will believe every delegable team ask goes to the Officer and
will be surprised by the highest-volume one going to the Leader. No safety impact.
*Minimal fix*: docs only — one paragraph in `ADR-alpha6-review-capability-20261103.md` §2b ("the Alpha.5
parameter/permission lane is outside the A6 ordinary-tool closed set: it carries no tool-governance
binding, so it stays with the Leader") and one sentence in `RELEASE-NOTES-0.1.6.md` §2.2. Zero code.
*Do not* do the seam change (Option S, §1.4) without an explicit product decision — it moves every
builtin-tool ask onto the Officer.

### P1-2 — the permission lane has no execution fact, so "consumed" ≠ "ran" is unprovable there
*Evidence*: §5.3; writer `service.ts:3561`, callers `agent-bindings.mjs:3234-3235`, `root.ts:2902-2906`.
*Why P1*: it is the same class of defect as F-4/PD-41 (a consumed approval with no execution), but for
this lane it is invisible instead of merely fail-closed — the ledger simply stops at the consumption.
An incident review cannot tell a successful bash ask from a dispatch refusal.
*Minimal fix*: one observer in the permission adapter's post-body path calling
`controlService.recordExecutionResult({requestId: legRequestId, callId: correlation, outcome})` (the
adapter already has both values at `:1905-1930`), plus the one-line matcher widening in
`recordExecutionResult` to accept a `correlation` match when `reviewPayload.callId` is absent. Two files,
no authority change.

### P1-3 — a permission ask can be silently un-woken when the Officer state is a `hold`
*Evidence*: `notifier.ts:177-186` handles only `route.kind === 'unroutable'`; `routeReview` evaluates
`routeOfficerState` **before** the delegable-ask arm, so a Team with zero or two live Officers returns
`hold('officer-…')` and the notifier **throws** ("no Officer wake and no Leader fallback",
`:186-191`). The throw is fire-and-forget (`root.ts:3172-3184` → `onNotificationFailure`).
*Why P1*: in an opted-in Team that boots with no Officer yet — a legal state, since boot only checks the
template declaration (§8.1) — the Leader is never told about a permission ask. The ask is durable and
appears in `team_list_pending_control`, so it is not lost, but the wake contract is broken for exactly
the row shape F-3 describes. `whenOfficerUnavailable` is a **required** v5 field with no default
(`domain/blueprint/src/blueprint-v5.ts:97,243-246`), and the `hold` branch is the one that throws; every
committed v5 blueprint in this repo's evidence sets it to `hold`
(`v016-packaged-acceptance/run-1/config/saved-blueprint-v016-pack-bp-r1.yaml:180`, run-2 `:180`), so the
throw path is the *configured* path, not an exotic one.
*Minimal fix*: move the `legacyLeaderRow` carve-out before the hold/unroutable split (it is a property of
the *row*, not of the route), or extend it to `hold` reasons that are officer-state-only. One condition,
no new authority.

### P1-4 — PD-41/PD-42 are unregistered and F-1/F-4 are undisclosed despite a commit that says otherwise
*Evidence*: §8.2 D1 (`git show 8ebb68b6f --stat`: 1 file, 1 insertion, PD-20 anchor).
*Why P1*: the debt register is the repo's decision record; two open defects that the release artifact's
own evidence books are missing from it, and the notes an operator reads do not mention the two most
surprising behaviours (planes are exclusive per Team; a consumed allow may never execute).
*Minimal fix*: add the PD-41 and PD-42 rows (measurement, falsifier, smallest honest fix — both already
written in the `v016` README §6) and the two §4 items; correct the record on `8ebb68b6f`.

### P1-5 — §5's A6-26 mechanism is not derivable from the code on this base
*Evidence*: §8.2 D4; §10.
*Why P1*: the safety half of A6-26 is measured and stands, but the *mechanism* sentence is the part an
operator will reason from ("the crash marks it abandoned"), and in this tree a decisionless request is
never marked abandoned. Either the sentence or the code is wrong, and nobody can tell which from the
artifact.
*Minimal fix*: re-state §5 without the mechanism claim ("the run's request ended durably abandoned with
reason `invocation-abandoned`; the writer path was not established"), and open a small host-free test
that reproduces the accepted-but-unclaimed crash on the current tree and asserts which writer fires.

### P2 (worth booking, not blocking)
D3 (PD-40 anchor + second writer), D5 (reason-string collision), D6 (§4.7 writer list), D7 (timeout
abandons), D8 (`wake-plan.ts` doc), D9 (§8 abandonment vocabulary), D10 (`composition.ts` header),
D11 (missing evidence trees on the base), plus the two anchor drifts in §8.3.

---

## 10. What I could not determine

1. **Who wrote the `invocation-abandoned` abandonment in `a6-gaps-g2-unclaimed-r11`.** The row has no
   decision; the three writers in this tree all require either a durable `allow` on that request or a
   bounded-wait expiry, and the run manifest records `optIn.timeoutMs: 0` (so the 600 000 ms default
   applied and no expiry was possible within the run). Two explanations remain: the evidence's
   `productSha 78bde9f10…` tree contained a writer that is not on `origin/master`, or the §5 mechanism
   sentence is wrong. **I could not distinguish them without booting a Host, which this lane may not do.**
   What I *can* say: the safety claim (no duplicate, no side effect, not decidable, not redelivered) is
   measured and consistent with `resolveControl:3215` and the boot settlement's refusals.
2. **Whether the permission lane's `allow` is ever consumed without an execution in practice.** The code
   permits it (no execution fact, and no observer); no committed evidence isolates it, because no
   evidence run looks for a permission-lane execution fact. A host-free harness could show it in one
   boot; that is a measurement, not a reading.
3. **Whether F-5's refusal is a fact-port arm or an upstream one.** The error text matches
   `assignedOfficerCapability`'s problem plumbing, but `v016` records only the message, not which refusal
   arm fired. Distinguishing them needs the run's debug log (not committed) or a re-run.
4. **How bad P1-3 is in practice.** `whenOfficerUnavailable: 'leader'` would turn a missing/retired
   Officer into a Leader route instead of a hold+throw. I verified the field is required with no default
   and that every committed v5 blueprint in evidence uses `'hold'`; I did not enumerate blueprints
   authored outside this repo, so I state the hold/throw path as *the evidenced configuration*, not as
   *universally deployed*.
5. **The client/GUI rendering of an abandoned row.** I verified the model layer mirrors the kinds and
   roles (`control-surface.ts:39-41`) and that the ledger page can read an abandoned request by id
   (§5's "discoverable" claim), but I did not trace the projection through the web bundle; the claim that
   it "does not appear in `team_list_pending_control`" is server-side and I did verify the pending filter
   excludes abandoned rows, not the exact GUI affordance.

---

## Appendix A — files read (this tree, `9e1c493b6`)

Control: `control/service.ts` (6945 lines, read in sections: 316-380, 2000-2060, 2472-2960, 2897-3100,
3165-3470, 3477-3660, 4130-4450, 4619-4700, 4901-4930, 5590-5700, 5775-5980), `control/types.ts`
(160-200, 1700-1720, 2370-2390, 2710-2760).
Alpha.6: `alpha6/assigned-officer-facts.ts` (full), `alpha6/notifier.ts` (full), `alpha6/root-router.ts`,
`alpha6/composition.ts`, `alpha6/root-composition.ts`, `alpha6/wiring.ts` (84-95), `alpha6/wake-plan.ts`,
`alpha6/wake-intent.ts`, `alpha6/wake-intent-store.ts`, `alpha6/wake-intent-directory.ts`,
`alpha6/wake-dispatch.ts` (claim/release/dispatch/recover), `review-router/router.ts`,
`review-router/policy.ts`, `review-wake/coordinator.ts`.
Planes: `operation-permission/pre-execute-adapter.ts` (528-560, 700-760, 1800-1960, 2060-2160),
`operation-permission/pa-control-bridge.ts` (300-330, 360-620), `operation-permission/approval-routing.ts`
(240-400), `tool-dispatch/closed-world-guard.ts` (180-210), `governance/service.ts` (990-1030),
`action-router/router.ts` (500-660), `team-services/src/product-assembly.ts` (700-810).
Tools: `packages/tools/src/tools.ts` (340-370, 1000-1120), `packages/tools/src/guard.ts`,
`packages/tools/a5p5-tools/src/pipeline.ts` (70-210).
Plugin: `src/plugin/root.ts` (220-260, 2430-2560, 2560-2760, 2760-2860, 2846-3110, 3130-3200, 5150-5170),
`src/plugin/host.ts` (3020-3130, 3380-3395), `src/plugin/live/agent-bindings.mjs` (3190-3260, 3975-4000,
6000-6110), `src/plugin/live/ptc-escalation-row.mjs` (60-120, 350-470).
Client: `packages/client/src/model/control-surface.ts` (30-50).
Docs/evidence: `RELEASE-NOTES-0.1.6.md` (§1-§8), `PRODUCT-DEBT-REGISTER.md` (PD-40 and the tail),
`ADR-alpha6-review-capability-20261103.md`, `alpha6-blueprint-router-wake-rebase-20261103.md`,
`v016-packaged-acceptance/README.md` §5/§6, `c2-adjudication-2/README.md` §3, `wp1-sticky-stop/README.md`,
`wp2-a6-governed-goal/README.md`, `wp3-fence-timing/README.md`,
`a6-gaps-g2-unclaimed-r11/{README,run-manifest.json}`, and `git show 8ebb68b6f`.

## Appendix B — how to re-check the cheap claims

```bash
git -C .worktrees/audit-b grep -n "requestApprovalLeg" -- packages/runtime/operation-permission
git -C .worktrees/audit-b sed -n '174,192p' packages/runtime/alpha6/notifier.ts        # the F-3 carve-out
git -C .worktrees/audit-b sed -n '375,378p;4414,4440p' packages/runtime/control/service.ts  # the fence
git -C .worktrees/audit-b show --stat 8ebb68b6f                                        # D1
git -C .worktrees/audit-b grep -c "PD-41\|PD-42" docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md  # 0
```

Host-free suites that cover this area (not run here, quoted for the next lane):
`packages/runtime/test/a6-*.test.ts`, `a5p7-*`, `a5ptc-escalation-row.test.ts`,
`packages/runtime/test/pd41-allow-semantics.test.ts` (on the PD-41 branch only).
