# Independent review response — Alpha.6 E2E delta

Reviewer verdict: **BLOCK**, two P1s, no P0. Reviewer was read-only at
`8ea3a0517`; this response is bound to the follow-up code at `996427e3f` and the
integration merge that contains it.

## P1-1 — Leader fallback bypassed an authored hold — FIXED

`packages/runtime/alpha6/notifier.ts` now permits the legacy Leader notification
only when ALL hold:

- the route is `unroutable` (never `hold`);
- the row is a durable `leader-approval` with `reviewAuthority === 'leader'`;
- the row has no `operationToolOwner` / `operationToolName` (the legacy
  `parameter-permission` shape).

A policied `hold` throws the same "no Officer wake and no Leader fallback" error
as every other non-recipient route. Regression tests added:

- `never lets an authored hold become a Leader decision` (A6 ordinary row with
  tool owner/name → throws, zero Leader notifications);
- `delivers an UNROUTABLE legacy guard row to the Leader, not an A6 ordinary
  ask` (legacy shape → Leader notified).

## P1-2 — per-root routing did not reach the router — FIXED

`Alpha6RootRouterInput` now accepts `routingForRoot`, returning the request
root's frozen v5 `routing` + `leaderTemplateId`. `route(requestId, root)` uses
that policy for `blueprintReviewPolicyFrom`, the Officer/Leader template
selection and the category lookup. `routingForRoot === undefined` keeps the
single-root/test behavior; an explicit `null` returns
`hold('config-invalid', no frozen v5 review routing is resolvable for root ...)`.

`root-composition.ts` exposes the resolver from the same `blueprintSourceForRoot`
parse used by the facts port; `src/plugin/root.ts` threads it into the router and
uses the request root for the category callback.

Regression tests added:

- child root with a divergent `officerTemplateId` routes to the **child**
  Officer, not the boot Officer / a hold;
- an unresolvable child root holds `config-invalid`.

## P2-1 — `routingForRoot` null reused boot routing — FIXED

`assigned-officer-facts.ts` now distinguishes `undefined` (no per-root resolver;
use boot routing) from `null` (this root is refused). Test added:
`refuses a root when routingForRoot explicitly answers null`.

## P2-2 — no tests for the authority wire — FIXED

`a5w-vseam-pa-verifier-seam-c1.test.ts` now covers the verifier directly:

- a member-principal PA allow carrying durable `reviewerAuthority: 'leader'`
  passes the all-Effects verifier;
- the same manifest/decider without the evidence stays fail-closed
  (`pa-authority-drift`).

The landing presenter and `requestedEffect: 'allow'` remain evidenced by the
real-Host ledger (seq 8/9 and 11/12); the new test pins the security-critical
verifier branch. The real Host E2E was rerun after these fixes at `c26a9a00`:
6/6 criteria, one execution, 2/2/2 consumption, pending 0.

## P2-3 — gate evidence — ADDRESSED

A full `--full` gate is rerun at code HEAD `c26a9a00`; `gate.md` binds
the result and keeps the earlier census-flake disclosure. The pre-existing
`a6-pr1-lane-hygiene` `readFileSync` race is disclosed, not hidden; no assertion
was changed to obtain a green.

## P3 items

- `notifier.ts` non-route fallback now resolves `request.rootSessionId`, not the
  boot root.
- The ARC-A override reason for `pa-control-bridge.ts` now says the allow effect
  is inside the `a6:true` branch and the landing presenter is gated by durable
  decision evidence (fallback reproduces the old decider rung).
- The `32`-id cap / newline limitation is left as-is: ids are server-minted;
  documented as theoretical, no authority impact.
- A6-5 wording is scoped in the acceptance matrix: `leaderWakes=0` counts review
  wakes, not the separate legacy guard notification.

## Independent re-review of the fix commit

A second read-only reviewer examined `8ea3a0517..996427e3f`. Verdict:
**PASS_WITH_P2** — both earlier P1s closed, no new P0/P1, no authority
widening; the only substantive finding was that the first `routingForRoot:
null` regression test was non-discriminating (it used an empty control state,
so the old boot-reuse path was never reached).

That test is now leg-bearing: a valid leg under the BOOT policy plus the boot
Officer, with `routingForRoot: () => null`; only the fixed refusal yields null
(`a6-assigned-officer-facts.test.ts`). Two P3 test gaps were also closed:
an **unroutable A6 ordinary ask** must throw with zero Leader notifications,
and a non-route wake resolves against `request.rootSessionId`, not the boot
root. Fix commit: `90937099d`; integration merge: `f842c6821`.

The same re-review noted only defense-in-depth P3s that are not reachable for
a PA/A6 ask (the case-less row path; `PlannedWake.templateId` feeding only the
plan fingerprint) and did not run the full gate.

## Independent review of the recipient/refusal delta

A read-only reviewer examined `b4d4d21e..8114db4b7` (product delta =
`fd7a5d6c1`, the `reviewEvents` consumer). Verdict: **PASS WITH NOTES**, no
P0/P1 product or authority defect. The consumer is notification-only, re-reads
the durable row, never mints or consumes an approval, and cannot misdeliver the
transferred leg (target is always Leader; `native-human` is a no-op).

P2 findings and disposition:

1. **Human-wake overstatement** — fixed in the matrix (row 13 now says
   authority/decidability PASS, Host human wake NOT_REACHED) and in the
   `root.ts`/built-dist comment, which no longer claims the human successor is
   woken.
2. **Stale matrix gate/HEAD text** — matrix now pins `4e569e757`; the heading
   and closing verdict no longer say all remaining rows are NOT_REACHED.
3. **Stop assertions** — the raw run contains the `CONTROL_REQUEST_DECIDED`
   rejection; `stop.md` states it. The A6-12 label was not tightened in code,
   so treat the assertion as weaker than the evidence narrative.
4. **Exception causality** — `leader-exception.md` now says only the PA leg is
   the discriminator; the guard uses the ordinary legacy Leader path.
5. **Fence annotation** — stale L598/L787/L1191/L1815 comments replaced with
   the recorded L614/L803/L1304/L1935.
6. **Raw runs untracked** — `a6-handoff-only-r6`, `a6-human-r9`,
   `a6-stop-r3`, `a6-exception-r2`, `a6-recipients-r6/r12` are committed
   (tokens redacted).
7. **No unit test for the new sink** — still open; the E2E and the code
   argument above are the current evidence.

Residual risks accepted: notification failure is reported, not retried;
Officer/human branches of the sink are currently unreachable; the same-session
queued-wake gap remains row 15 BLOCKED/PARTIAL.

## Review at gated `212c4fba2` — BLOCK, and the response at `1e50d55fc`

A second read-only review (code head `212c4fba2`) returned **BLOCK, no P0**.
The authority/execution plane was found clean; the findings were at the new
Stop/resume boundary and process level.

| Finding | Response |
| --- | --- |
| P1-1 internal cancels request `{kind:'user'}`, so a tool/parent abort or archive interrupt could create a Sticky Stop | FIXED: the team's own aborts now request `{kind:'hook', reason:'team-work-delivery-aborted'}` and interrupts `{kind:'hook', reason:'team-member-interrupt'}`; only a real `session/cancel` reaches `user`. |
| P1-2 team/model deliveries carry `source.kind==='user'`, so a Leader message could clear a human Stop | FIXED: internal work/messaging/root deliveries carry `plugin:dsh-agent-team`; the messaging port keeps `user` only when the attribution carries `fromHumanId`. Team-internal messages no longer resume. |
| P1-3 post-restart resume was a silent no-op (no coordinator after the Stop cleared the intent row) and the marker survived | FIXED: the marker now stores the latch key + reviewer `targetSessionId`; boot registers stopped latches from markers, and resume rebuilds the latch from the marker on demand, clears it, dispatches `resume`, then re-plans through `alpha6DispatchWake`. `A6-24` PASS. |
| P1-4 the tree was not at the gated head while docs claimed clean | FIXED: product + kit + ARC override committed at `f68dc137c`, dist glue/fence/docs at `1e50d55fc`; full gate **9/9** at `1e50d55fc` on a clean tracked tree. |
| P2-1 A6-22/23 labels over-claim “withdraw the queued row” (the mock had consumed the wake) | DISCLOSED, not over-claimed: the probes prove the durable marker, no post-restart re-delivery, and (now) resume; queued-vs-claimed row withdrawal is not separately asserted. |
| P2-2 A6-20 accepted any durable decision | FIXED: it now requires `decision==='deny'` plus no consumption/execution; `a6-timeout-r5` PASS. |
| P2-3 A6-21 used the local ledger id | FIXED: the id is learned from the remote `team.getLedgerPage` fact itself (`remoteOnlyRequestId`); `a6-human-r13` PASS. |
| P2-4 stale matrix/gate/timeout docs | FIXED in this docs commit (HEAD `1e50d55fc`, new gate, wiring/resume status). |
| P3 swallowed `markStopped` failure | Accepted as a filesystem-only fail-open for Stop, disclosed; no authority effect (a missing Stop is fail-open for *stopping*, never for allow). |

The reviewer's unverified list is addressed by the new Host runs: normal
`a6-normal-r6`, handoff `a6-handoff-r8`, timeout `a6-timeout-r5`, human
`a6-human-r13`, Sticky Stop/resume `a6-sticky-stop-r12`, and the gate above.
New-call-after-resume chaining and crash settlement remain open (below).


## Second review at `1e50d55fc` — BLOCK, response at `fa87927fd`

The follow-up review closed P1-1/P1-2 and the core of P1-3, but found a new P1:
resume passed `currentLegIds: []` to `alpha6DispatchWake`, fabricating a
zero-leg "ready" fingerprint. That could (a) duplicate a wake for unchanged work
after the next post-turn rescan, (b) fire a spurious wake on an ordinary human
chat on a live latch, and (c) contradicted the comment.

FIXED at `fa87927fd`: resume now dispatches only when the reducer transition is
`applied`, reads `readControlState`, runs the same `collectAlpha6DelegableLegs`
+ router path as the boot rebuild, and dispatches only when `fresh.length > 0`
with the real request ids. Boot intent recovery now keys the Team by the row's
own `rootSessionId` (the mount root is not always the Team root), so accepted
wakes are actually reconciled; foreign/stale markers are skipped using the live
Team record + generation.

P2s: the Sticky Stop marker is written atomically and `isStopped` is a file
existence check (a torn/older marker cannot re-open a stopped reviewer); marker
round-trip/torn-marker unit tests added. The current tree is gated at
`fa87927fd` (9/9, census 677/8832). Remaining P3s are disclosed, not claimed:
A6-22's label still cannot distinguish withdrawal from an already-consumed row;
A6-24 counts model requests rather than delivered messages; resume rebuild does
not take the wake lock.


## Third review of `fa87927fd` — BLOCK, response at `fedd641ed`

The reviewer confirmed the resume P1 fix, then found two new P1s in the
cross-root recovery added alongside it: (1) `intent.key.sessionGeneration`
(static config generation) compared against the durable Team generation
(advances per ledger append) marked every live row stale; (2) "a durable Team
row exists" was treated as "live in this process", so a dormant Team from a
previous world could have its row/message cleared. P2: `isStopped` was
fail-open on non-ENOENT errors; the marker-registration generation filter used
the same wrong namespace.

RESPONSE at `fedd641ed`: boot recovery and marker registration are restored to
strict `rootSessionId === rootSid` + `config.generation`; `isStopped` is
fail-closed except ENOENT; the resume real-leg re-plan, atomic marker and unit
tests remain. The native-Inbox crash probe is explicitly NOT accepted because
the only way it exercised recovery was the BLOCKed cross-root path. A future
fix must carry an explicit mount-owner identity on the row/marker.

Residual P3s accepted: the env-gated A6-25 probe now fails by design under
strict own-root (kept as a future probe, excluded from acceptance); the
`ownerRootSessionId` field is written but not yet honored (reserved for the
safe fix, comments corrected in the follow-up design note); `isStopped`'s
non-ENOENT branch is code-read, not unit-tested.


## Closing round — `d37ed8a3f..28b61d4b2`

A separate independent review was requested for exactly this increment:
non-authorizing invocation settlement, A6-only timeout abandon, boot settlement
of dead PA invocations, accepted/claimed Inbox replacement wake, and marker
owner readback. Its verdict is recorded below when returned. No product change
may be claimed as reviewed before that verdict; the gate at `28b61d4b2` is
9/9 independently of it.

Disclosed scope: the body-started-result-unknown real-Host probe is NOT proven
(the delaying command routes to the A5 parameter-permission lane, so no Plane
PA row is created); the consume case proves zero execution and the shared
`execution-outcome-unknown` settlement, not a real body start.
