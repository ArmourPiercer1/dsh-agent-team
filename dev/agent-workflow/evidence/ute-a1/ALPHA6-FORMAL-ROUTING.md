# Alpha.6 — what is actually missing, decided BEFORE any code (round 84)

Input: review `20261122-2305` §4.3; `OWNER-DECISIONS.md` §6; the C-alpha6 row in
`CAPABILITY-MATRIX-C.md`; `ADM-98`/`ADM-99` (round 57); `ADM-116`…`ADM-118` (round 68); the round-63/68
D3 live measurements.

The owner's question is narrow: **finish the FORMAL routing so Alpha.6 can be enabled through real
product configuration, with its Officer approval and wake-up going through the governed path.** This
file states, before any implementation, which of the three named pieces is real, which is a wiring gap,
and which is a category error that must NOT be "fixed" by inventing an axis.

Baseline facts cited below are at HEAD `9160d9b6f` (the round-83 tip of `vnext/a1-cut`).

---

## The three pieces, one at a time

### Piece 1 — the review-routing "axis" (who may be reviewed, which route, which Officer)

**What EXISTS (real, and already the ONE policy):**

| concern | module | what it decides |
| --- | --- | --- |
| who may be reviewed | `packages/runtime/review-router/policy.ts` (`isDelegableOrdinaryToolAsk`, `isLeaderException`) | the closed ordinary-ask set (kind, rung, effect, fingerprints, authority scope, tool coordinate, required authorities) and the authored Leader exceptions |
| which route | `packages/runtime/review-router/router.ts` (`routeReview`) | `recipient` (officer/leader) · `hold` (officer-not-admitted / ambiguous / unconfirmed / config-invalid / leader-unavailable) · `no-work` · `unroutable` |
| which Officer | `packages/runtime/alpha6/root-router.ts` (`officerStateOf`, `leaderTargetOf`) + `alpha6/composition.ts` (`decideAlpha6Composition`) | exactly one live Officer (CREATED/RUNNING/SETTLED), the Leader as a distinct target, zero/multiple Officers refuse |
| may this Officer decide this leg | `packages/runtime/review-authority/evaluator.ts` | the ReviewCapability, incl. `operation-owner-is-officer` (self-ask), `leader-exception`, `reviewer-not-current-officer`, `requires-human`, `transfer-overrides-delegation` |

Every one of these is a **pure function over trusted facts**, and the facts come from the durable
control row + durable member rows (`assigned-officer-facts.ts`), not from the model. The root already
wires all of them: `root.ts:3122-3145` (router), `:3147-3170` (notifier), `:3172-3205` (transfer
events), `:3214` (`control` with the alpha6 ports).

**What is NOT there, stated precisely:** the decision leaves **no admission-shaped durable trace and no
delivery record**. It is taken inside a notifier call rather than recorded as an operation; and the only
durable artefact of "a wake was routed" is the Alpha.6 wake-intent *file* row
(`alpha6/wake-intent-directory.ts`), which is the latch's single-flight state, not a TeamDomain fact.

**What is NOT missing — and must not be invented:** a "review-routing axis" in the centre's closed
vocabulary (`admission.ts:32` `TOOL_AXES`, `:57` `CENTRE_TOOL_NAMES`, `:114`
`HOST_CAPABILITY_TOOL_NAMES`). A routing decision **executes nothing**: no body, no locator, no
provider. `ADM-99` already measured what happens when the decision subject is driven at the centre —
`ADMISSION_TOOL_UNBOUND` recorded on the fallback axis `fs.read`, i.e. a fabricated-axis record. Adding
`review-routing` to a tool-axis table would make the centre claim to judge an execution that does not
exist, and is the "second execution authority by relabelling" the A1 law forbids. **No new axis. No
contract change. No `CORE_SEAM_BLOCKER` here** — no upstream seam is needed, because nothing about this
decision is an upstream operation.

**The lawful formalisation:** the routed review is already an ordinary governed operation *if the wake
is a delivery and the Officer is a governed Member*:
- the reviewed operation was admitted by the centre (the durable control row is the centre's own record);
- the routing decision is a **projection of that durable row through the ONE policy**;
- the wake is **input delivery** — the same class as `member.send`, explicitly "deliver work, never
  execute tools";
- the Officer's approval is `team_resolve_control`, a `CENTRE_TOOL_NAMES` member, admitted under the
  **Officer's own binding** and gated by the ReviewCapability evaluator;
- any other tool the Officer calls is admitted by the same `admit()` under the same binding;
- Stop is the existing latch/sticky-stop plane.

So piece 1 is a **join on existing centre surfaces**, not a new axis.

### Piece 2 — the wake path

**What EXISTS:** `live.deliverReviewWake` (`packages/runtime/src/plugin/vnext/agent-bindings.mjs:4187`)
resolves the live agent and calls `followup`/`steer` with a rendered message. The latch/Stop plane
(`alpha6/wake-dispatch.ts`, `wake-intent-directory.ts`) and the native-inbox probe
(`reviewWakeInbox`, `:4137`) are real and wired (`root.ts:2586-2660`, `:2864`, `:3052`).

**What is MISSING (measured, and it is the round-83 gap):** that seam **bypasses the P6-T3 delivery
mechanism** the same round built for `member.send`:
- no durable delivery intent fact and no confirmation fact in the TeamDomain ledger (round 83's
  `member.send`: intent fact → inbox acceptance → confirmation fact, the ACK is the answer);
- no `SessionInputPort.submitAttributedInput` call, so the wake skips
  `prepareAgentForRequest` and the **requirement-aware final-input verdict** (`Finding F`);
- no machine attribution: a raw `createUserMessage({source:{kind:'plugin:dsh-agent-team'}})` is written
  directly, so the A56 machine-input ledger (`machineInputs`, `isHumanInteractionClaim`) never sees it
  and the Alpha.6 Sticky-Stop law ("only a human interaction clears a human Stop") is not applied to
  the very input the review plane introduces;
- the message is delivered with no correlation token the ledger can reconcile, so a crash between
  "decided" and "inbox accepted" is recoverable only through Alpha.6's private file directory.

That is a **parallel delivery path**, which is exactly what the owner asked to remove.

### Piece 3 — the enablement config

**What EXISTS:** two gates, both refusals: the pure row rule (`centre-config.ts:73`, `ADM-34`) and the
root gate (`root.ts:2496-2510`, `ADM-85`); the host entry records the row refusal durably (round 68,
`row-refusal-entry.ts`).

**What is MISSING:** there is **no coherent configuration** in which the opt-in is admitted. The rule
refuses `alpha6ReviewRouting: true` unconditionally, and the root gate refuses `mode:'alpha6'`
unconditionally. The pieces a coherent row actually needs are already implemented and already required
by separate gates — they are simply never *satisfiable together*:
- a v5 Blueprint whose `reviewRouting` block is authored (`blueprint-v5.ts`; v5 IS a supported
  document version, `schema.ts:95`);
- a durable centre (`centreStatePath`) — the routing/delivery facts and the settlement have to live
  somewhere;
- an absolute durable wake-intent directory (`alpha6WakeIntentPath`, already required at
  `root.ts:2533`);
- the live delivery seam and the native-inbox probe (already required at `root.ts:2521`, `:2544`).

So piece 3 is a **coherence rule with typed refusals** plus the removal of the two unconditional
refusals, keeping every existing refusal arm (an incoherent opt-in is still refused, still with its
code, still with the recorded fact + settlement).

---

## Verdict per piece

| piece | state at HEAD | what this round does |
| --- | --- | --- |
| review-routing axis | policy real, NOT joined as a recorded operation; **no axis is lawful** | record the routed review as a **delivery operation** (durable intent + confirmation facts, correlation token) and prove the Officer's own calls are admitted under its binding. **No new axis, no contract change.** |
| wake path | real, but a parallel `followup`/`steer` path | route it through **`SessionInputPort.submitAttributedInput`** (round 83's mechanism: requirement gate, machine attribution, inbox acceptance) and ledger the intent/confirmation pair |
| enablement config | two unconditional refusals | coherence rule: enable iff v5 `reviewRouting` + centre + absolute wake-intent path are all present; refuse with the piece named otherwise |

**`CORE_SEAM_BLOCKER`: none.** No upstream patch, no private API, no host-side change is required for
any of the three pieces. What remains out of reach is *evidence level*, not implementation: see
"Not proven" in the settlement section (`CAPABILITY-MATRIX-C.md`) — a live boot that reaches a routed
decision needs a world that (a) authors a v5 routing block, (b) has an Officer Member instance with a
binding, (c) produces a pending ordinary `leader-approval` leg, and (d) lets the Officer resolve it
through the mock model. Whether the D3 world can express (b)–(d) is measured below and reported
honestly rather than claimed.

---

## What was implemented (as determined above)

| piece | file | what it does |
| --- | --- | --- |
| routing decision | `packages/runtime/review-router/router.ts:90` (unchanged), exercised by `ADM-142` | the ONE shared policy projects a durable control row onto a recipient; the decision executes nothing and its input is frozen |
| wake delivery | `packages/runtime/src/plugin/vnext/review-wake-delivery.mjs` (new) | durable `team-review-wake-routed` intent → `SessionInputPort.submitAttributedInput` → `team-review-wake-delivered` confirmation; duplicate converges; unknown recipient is a typed refusal BEFORE any write |
| glue | `packages/runtime/src/plugin/vnext/agent-bindings.mjs` `deliverReviewWake` | delegates to the port above; resolves the recipient from the durable Member row and refuses an invented one |
| notifier seam | `packages/runtime/alpha6/notifier.ts`, `packages/runtime/src/plugin/types.ts` | the routed reviewer + the durable leg ride the delivery instead of being re-derived |
| enablement | `packages/runtime/src/plugin/vnext/centre-config.ts#alpha6EnablementRefusal` | admits a coherent row; otherwise refuses with the FIRST missing piece (`ADMISSION_ALPHA6_ROUTING_REQUIRED` / `_CENTRE_REQUIRED` / `_WAKE_INTENT_PATH_REQUIRED`) under the unchanged `ADMISSION_ALPHA6_UNAVAILABLE` prefix |
| direct-root gate | `packages/runtime/src/plugin/vnext/root.ts` | same rule, records the piece code through the row's own refusal point (reason bounded for the 512-char settlement) |

## Verification (real ports, in process)

| arm | proves |
| --- | --- |
| `ADM-141` | coherent config ADMITTED; each incoherent piece refused with its own code AND recorded |
| `ADM-142` | the shared policy routes an ordinary ask to the Officer; nothing executed; input frozen; no policy ⇒ hold |
| `ADM-143` | one attributed inbox input; intent + confirmation facts in order, correlated; machine attribution (A56: not a human claim); ZERO tool executions |
| `ADM-144` | the Officer's `team_resolve_control` admitted on `team.control` under ITS binding; unbound caller ⇒ `ADMISSION_NO_BINDING` |
| `ADM-146` | duplicate wake ⇒ ONE confirmation; unknown recipient ⇒ typed refusal with zero facts and zero input |
| `a6-pr4-review-wake-glue` | the real glue delivers ONE input to the RESOLVED child session with the producer's machine source, and writes the fact pair |
| `a6-pr7-merged-wake-host` | three routed asks ⇒ ONE attributed inbox input |
| `a6-root-wiring` | a PRODUCTION root boots a coherent Alpha.6 row (and still refuses a wake-less, store-less or non-v5 row) |
| `ADM-34/85/99/116/117/118` (kept) | an INCOHERENT row is still denied, typed, recorded, settled `REFUSED`, with zero wakes |
| `d3:alpha6` (kept, live) | the refusal still happens on a real host boot with its durable fact |

## Level reached, and what is NOT proven

**MECHANISM, proven over the real ports.** The live **routed** wake is NOT proven: the D3 world
publishes a v4 blueprint with a single worker member, so it cannot express (b) an Officer Member with a
binding, (c) a pending ordinary `leader-approval` leg, or (d) an Officer resolution through the mock
model — it can express only the refusal side, which it continues to measure. No cell is upgraded to
PRODUCT-PROVEN, and the capability matrix says so.

---

## ROUND 87 (2026-11-23) — the live answer: (b) and (d) are reachable, (c) is NOT, and the product says why

The round-87 task was the last piece named above: author a v5 world with an Officer and an ordinary
tool ask, boot it, and prove the routed wake live — or stop with the precise blocker instead of
simulating it. The instrument is
`tests/world-factory/drivers/d-boot-feasibility/probe-d4-routed-wake.mjs` (two agreeing DEV-LIVE
boots, rc.2 host `639ed015…`, HEAD `775be06d7`); the evidence and the full argument are
`dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md`.

**What is now LIVE (new, and better than the mechanism half):**

| judge | live result |
| --- | --- |
| `d4:enablement` | **PROVEN** — a COHERENT row is admitted by `alpha6EnablementRefusal` and the host really boots a Team (`teamSession` served, zero Alpha.6 denial facts). Round 63/68 could only measure the refusal. |
| `d4:officer-up` | **PROVEN** — the Officer MemberTemplate comes up as a RUNNING instance with its own child session that runs. |
| `d4:officer-binding` | **PROVEN** — the Officer's OWN call is admitted by the ONE centre under ITS binding (1 allow `invocation-authority` fact for its callId, settlement `ADMITTED→RUNNING→COMPLETED`). |
| `d4:refusal` | **PROVEN** — the same v5 document with `reviewRouting` removed is still refused by name, recorded, settled `REFUSED`, with zero wakes. |

**What is NOT reachable, measured (not inferred):**

| judge | live result |
| --- | --- |
| `d4:routed-wake` | **REFUTED** — the worker's authored `ask` lane creates a real durable `leader-approval` row, and it carries **no `approvalCaseId` / `legOrdinal` / `reviewAuthority`**. The PRODUCT's own `createAlpha6RootRouter.route()` answers `null` for that row with `memberListCalls: 0`; **zero** `team-review-wake-routed` / `-delivered` facts, **zero** wake-intent files, the **Officer is never woken**, and the **Leader** receives the plain C1 ask instead (`[team-control … waiting for Leader approval`). A disk-wide scan for `[team-review-wake` finds nothing. |

**TWO Team-side seams are missing — and NEITHER is a `CORE_SEAM_BLOCKER`:**

1. **No live producer of a case-bearing ordinary ask.** `route()` needs `approvalCaseId` +
   `legOrdinal` (`alpha6/root-router.ts:209`); the case-less branch routes to the Leader by design
   (`alpha6/notifier.ts:159-169`). The only live leg producer is `requestApprovalLeg`
   (`control/service.ts:5607`), whose single live caller is the governance **envelope-mutation** lane
   (`governance/service.ts:1016`) — excluded by `isDelegableOrdinaryToolAsk`
   (`review-router/policy.ts:68`). Both ordinary-ask producers are case-less by construction: the
   centre admission ask (`src/plugin/vnext/admission-port.mjs:155-165`, no `leg`/`reviewPayload`/
   `operationFingerprint`) and the model-facing `team_request_control` (`packages/tools/src/tools.ts:
   973-1000`, no case argument in its schema). The lane that used to mint ordinary-operation legs was
   the Alpha.4 PA ask path, **deleted by the A1 cut** (`1617d5839`); its survivors
   (`routeOperationApproval`, `createOperationApprovalFactsReader`) are pure/test-only or
   consumption-only (`root.ts:3268`), as the repo's own test comment records
   (`a4p7-live-descendant-authority.test.ts:579`).
   **Minimal lawful fix:** open the admission ask through the case-forming call with the operation
   identity Alpha.6 already requires, i.e. an "Alpha.6-aware ask lane" — the exact thing the J06
   comment at `root-router.ts:212-216` anticipates. **No new axis** (unchanged from round 84).
2. **No consumer for an `ask`-disposition call, even after an allow.** With the Leader's allow
   durably recorded, the call was refused verbatim: *"authored locator … has the disposition 'ask',
   but this admission plane has no approval consumer (`resolveAskClassCall` has no production
   caller); refusing rather than auto-approving"*
   (`member-io-policy/src/provider-capabilities.ts:315`; its comment at `:200-205` names
   **BL-30**, and the backlog agrees: `ALPHA5-SANDBOX-BACKLOG.md:559` BL-30 READY, `:562` BL-33's
   consumption half blocked on it).

**Classification.** `CORE_SEAM_BLOCKER`: **none** — no upstream patch, no private API and no host
change is needed; both seams are our own product's tracked work. **Level stays MECHANISM**; the live
routed wake remains UNPROVEN, now by measurement. Duplicate-route (ONE wake) and
Sticky-Stop-not-cleared-by-machine-input stay unreachable with it, and their in-process arms
(`ADM-143`, `ADM-146`) are unchanged.
