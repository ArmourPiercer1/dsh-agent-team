# Alpha.6 PR3′ — SingleFlight review-wake scheduler: kernel design (2026-10-30 real UTC)

Status: design contract for the next Lane-2 implementation PR. Nothing here is wired; PR3′ ships
**dormant**, like PR0, with zero production consumers and zero delivery.

Source of the law it implements: PR #319 architecture §8 (SF-1…SF-4, WakeSlot, transitions, recovery
rules, A6-SF-02…A6-SF-10), revalidated by `s0-revalidation-20261030.md` §3 against host
`0.2.0-rc.2 @ 639ed01539` — which is where it changed from "trust the design" to "these are the actual
public seams, and these are the six gaps".

## 1. What this PR is, and the one line it must not cross

The kernel answers exactly one question: **given what the scheduler has already asked for, what should it
ask for next?** It is the thing that stops a hundred `request-control` messages from becoming a hundred
model turns.

The line it must not cross, from the phase's nine goals: **it holds scheduling state and nothing else.**
A `WakeSlot` is not an approval, not a case, not a decision, not a permission. It never carries an
`allow`, a decision value, a mandate, or case payload; nothing in this package may be *read as evidence
that a case exists* — existence is always re-read from ControlService/TeamDomain by the reviewer during
its own turn. The wake text carries a token and a pointer to "query your review work", never an approval
payload (SF: the notification may be lost, the authoritative Case may not).

Everything the kernel needs from the outside world arrives as an **injected port**; the kernel performs no
I/O, reads no clock, and imports no host module. Delivery — the `agent.followup` / acceptance-only
`deliverReviewWake` path in `live/agent-bindings.mjs` — is **PR-I2**, a named Center-Interface PR, not
this one. PR3′ therefore has no ability to wake anything, by construction rather than by configuration.

## 2. Shape

```
packages/runtime/review-wake/
  types.ts     closed vocabularies: WakePhase, WakeEvent, WakeEffect, refusal codes, WakeSlotView
  identity.ts  deterministic wakeId / correlator derivation (sha256 over canonical tuple)
  slot.ts      the transition function: reduce(previous, event, context) -> { next, effects, refusal }
  recovery.ts  the restart fold: reconcile(slots, observedInbox, observedTurns, context) -> actions
  index.ts     barrel + the dormancy declaration
```

**The store key IS the slot triple** (`rootSessionId | reviewerInstanceId | sessionGeneration`), one row
per triple, phases and counters inside it — added from round-3 design review, because the atomicity claim
depends on it and the earlier draft never said it. `WakeSlotStore.compareAndSwap` is atomic per key, so
"at most one outstanding slot per triple" (invariant 1) is store-atomic only while creation and update of
the same triple contend on the same key. If slots instead had their own row ids, two writers could each
create a first slot for one triple without ever contending, and invariant 1 would silently degrade from a
CAS to check-then-create. Consequence for the adapter and for matrix leg 9: the key is derived from the
triple by one exported function, there is no second index, and the test asserts that two concurrent first
requests for one triple produce exactly one surviving slot.

Pure and synchronous. `reduce` returns *effect descriptors*; an adapter (PR-I2, out of scope here) is the
only thing that could execute them. That split is the reason the 100-request and 1000-event tests below
run in milliseconds and are deterministic: no timers, no promises, no fakes whose behaviour I control.

### Ports (all injected; none implemented in this PR)

| port | what the kernel asks for | who will implement it |
| --- | --- | --- |
| `WakeClock` | `nowIso()` — the only time source, injected, so expiry/backoff are testable | runtime wiring (later PR) |
| `WakeSlotStore` | `load(key)`, `compareAndSwap(key, expectedRevision, next)` | storage adapter over the plugin's own `storageDomain` KvTables |
| `WakeLease` | current `leaseEpoch` + `writerToken` (fencing identity of this writer) | host/runtime wiring; **single-writer guarantee is NOT made here** |
| `PendingWorkSource` | `hasReadyWork(recipient, context)` — re-read of authoritative pending review work | ControlService/TeamDomain read path (PR2′/PR-I1 side) |
| `InboxFactSource` | which wake messages are still unclaimed, by `messageId` | `ctx.agents.get(...).inbox` / host facts (PR-I2) |

**Who is allowed to speak to the kernel** (round-3 review, undeclared before it): `claimed`, `turn-ended`
and `resume` are authenticated inside the kernel only by `wakeId`/correlator, and `wakeId` is a sha256 over
a *public* tuple — anyone who can name the triple can compute it. The kernel therefore cannot authenticate
event ingress by construction, and must not be asked to pretend otherwise. **PR-I2's obligation: the events
fed to `reduceWakeSlot` come from host facts only** (the inbox facts, the `turn/start` and `turn/end`
projections), never from a Member-authored message or a tool call. Blast radius if that obligation were
ignored is scheduling damage and nothing else — a forged `turn/end` advances a slot toward one cheap
re-read turn; a forged `resume` clears a suspension the scheduler itself set; neither can mint an approval,
a mandate or a decision, because no such field exists in this package (L-1) and the decision path
revalidates identity, leg and mandate independently (PR0 / PR-I1). That is the honest shape of the
guarantee: the worst case is bounded by what the state cannot say, not by the kernel's ability to check.

The kernel is total: every port call is treated as possibly-failing and a failure is a **refusal code with
a state transition**, never an exception and never a guess.

## 3. The state machine (SF-consistent, with the exact reason each edge exists)

```
idle ──request──> reserved ──accepted(messageId)──> queued ──claimed(turn)──> running
                    │                                  │                        │
                    │ withdraw(all resolved,           │ withdraw               │ turn/end(correlator)
                    │   unclaimed only)                ▼                        ▼
                    │                             [removeMessage]           reconciling
                    │                                                          │
                    │                no ready work ────────────────────────────┤ ready work + budget
                    │                        │                                 │
                    ▼                        ▼                                 ▼
                suspended <──stop/close──  idle                          reserved (wake #n+1)
                    ▲                                                   
                    └── no-progress counter exceeded ── backoff ── budget exceeded ── suspended
```

Edges that exist because a specific failure was named in the design source, not for completeness:

- **`reserved/queued/running → suspended` on Stop, Team close, reviewer dispose.** A background notifier
  must never resurrect an Agent a human stopped (A6-SF-10). `suspended` is **not** retryable by a timer:
  only an explicit `resume` event leaves it, and `resume` is a human/Leader action, not a scheduler action.
- **`queued → [removeMessage]` only while unclaimed, and only by exact `messageId`.** Never `inbox.clear()`,
  never a message the plugin did not author. If it is already `claimed`, there is no effect at all: the
  reviewer's turn re-reads the case list and can end with zero business actions — a stale wake that costs
  one cheap turn is correct behaviour, a deleted user message is not.
- **`running` is left only by a `turn/end` that matches the claimed correlator.** `whenIdle()` and
  `agent/turn-stopping` are *not* completion facts (the design source is explicit: the hook runs before
  `turn/end` commits; and idle cannot prove *which* wake ran). A wake whose turn never ends is handled by
  the no-progress/backoff path, never by guessing.
- **`reconciling` re-reads before deciding.** Zero ready work ⇒ **no wake at all**, ever, and this is an
  absolute leg in the test matrix, not a probabilistic one (SF-4).

### Invariants the kernel enforces (each is a leg, each has a planted-widening negative)

1. **Single flight (SF-1).** At most one non-terminal slot per `(rootSessionId, reviewerInstanceId,
   sessionGeneration)`. A second `request` while a slot is non-terminal never yields a second `wake`
   effect; it sets `dirty`. 100 requests ⇒ ≤ 1 wake effect (A6-SF-02).
2. **Merging (SF-3).** Work arriving while `reserved`/`queued`/`running` marks the slot dirty and produces
   no delivery effect. The wake is never "about request a" — it says "re-read your work".
3. **No wake into an empty queue (SF-4).** `reconciling` + zero ready work ⇒ `idle`, no effect. A leg
   feeds a ready-work source that answers "yes" then "no" and asserts the second decision produces no
   effect and the slot lands `idle`.
4. **One wake per completed turn (A6-SF-03).** After a turn ends, at most one new wake may be reserved —
   whether the remainder is b/c or b/c/d.
5. **No resend after claim.** Once `claimed`, the kernel has **no** effect that re-delivers the same
   `wakeId`; bounded re-delivery exists only in `recovery.ts`, only for a slot whose message is proven
   absent from the inbox facts, and is capped per generation (`redeliveries` counter, refusal
   `REDELIVER_BUDGET_EXCEEDED`).
6. **Fencing.** Every event carries `leaseEpoch` + `writerToken`; an event whose epoch is below the slot's
   is refused with `STALE_GENERATION` and changes nothing — including a late `claimed`/`turn/end` callback
   for an Assignment that was handed off (SF: a stale `wakeId` callback must not revive a superseded
   Assignment).
7. **No progress, no storm.** A cycle that ends a turn and finds *the same* pending-work fingerprint
   unchanged increments `noProgressCycles`; at the bound the slot goes `backoff`, then `suspended` with
   `NO_PROGRESS`, and the kernel stops emitting wakes. The wake-storm failure mode is bounded by state,
   not by operator vigilance.
8. **Stop is sticky.** Any `request`/`claim`/`turn/end` arriving for a `suspended` slot is refused
   (`SLOT_SUSPENDED`) and produces no effect.

`wakeId` is derived, not random: `wake-<hex(sha256(canonical(rootSessionId | recipient | sessionGeneration
| wakeSequence)))>` via the same canonical JSON helper PR0 uses, so the same reserve cycle always yields
the same identity and a test can assert the *exact* string. A random id would make the crash-recovery fold
unable to recognise its own wake after a restart — the whole reason A6-SF-08 is passable at all.

## 4. The crash windows, stated instead of hand-waved

Two stores (plugin Kv + host Session inbox) and no distributed transaction, so the honest claim is:
**logical single flight while healthy; at-least-once work discovery across a crash; never a second
authoritative effect** — because the second physical message, if one exists, still only tells a reviewer
to re-read cases it did not already decide, and the decision path itself revalidates identity/leg/mandate
(PR0/PR-I1). Concretely the kernel is written so each window lands recoverable:

**The one window the pure shape cannot see, stated rather than hidden** (round-3 review): the
`reconciling → idle` edge trusts `hasReadyWork=false` *when the port answers successfully and is wrong*. A
stale read that says "nothing ready" releases the slot and emits nothing, and nothing rearms it until the
next `request` event. That is a lost-wake **liveness** hole, not an authority hole: the direction of failure
is "a reviewer is not notified", which is exactly the failure this notification is designed to survive —
the Case is still there, and the next request, the next turn, or a human reading the pending list recovers
it. It is worth naming because SF-4's absoluteness has a second reading: "no wake into an empty queue" also
means "a queue that was *reported* empty ends the flight". The kernel cannot distinguish "no work" from "the
port lied", and no leg can test the difference at C1, because the port is injected either way. The mitigation
that IS testable is the re-arm path: a later `request` for the same triple must reserve again from `idle`
(matrix leg 14), so the false negative costs latency and never costs the flight permanently.

| window | state after restart | recovery action |
| --- | --- | --- |
| slot reserved, message never sent | `reserved`, no `messageId` | re-emit the wake (same `wakeId`) — bounded |
| message accepted, checkpoint not written | inbox has it, slot says `reserved` | adopt the observed `messageId`, move to `queued`, **do not** re-send |
| claimed, `turn/end` lost | `running`, host idle | stay `running` until the no-progress bound, then `reconciling` via recovery — never a guessed completion |
| `turn/end` handled, new wake not yet written | `reconciling` | fold re-reads pending work and decides with the same rule as the live path |
| slot released, new request arrived in between | `idle` + a fresh `request` | normal reserve; the CAS on `revision` is what prevents the lost-wake race (A6-SF-07) |

Recovery is a **pure fold** over observed facts so it is testable without a host: give it the slot table,
the inbox facts and the turn facts, assert the action list. Real-host timing of `claim`/`turn/end`/
`remove`/Stop stays a **C2** obligation at the final merged HEAD (ENV_BLOCK here, never PASS).

### What C1 cannot prove here (named before the run, not after)

The unit matrix drives the reducer against a **model** of the store, so it proves the reducer's CAS
protocol (expected-revision discipline, refusal-on-lose) and not the adapter's real cross-process atomicity;
it drives `recovery.ts` against **synthetic** inbox facts, so it proves the fold's decisions and not the
truth of those facts. Both belong to C2, next to the existing timing legs, at the final merged HEAD on a
real Host: adapter atomicity under two processes, and inbox-fact fidelity (does `inbox` really still show an
unclaimed wake, and until when). A green unit matrix is not evidence about either.

## 5. Test matrix for PR3′ (unit tier C1; deterministic, no fake timers)

1. 100 requests, one recipient ⇒ exactly 1 wake effect, 99 merges, final slot `dirty=true` (A6-SF-02).
2. ABC: a's wake claimed → turn/end with b/c still ready ⇒ exactly 1 new wake, not 2 (A6-SF-03).
3. First-turn drain: all three resolved during the turn ⇒ 0 further wakes, slot `idle`.
4. Empty-queue absolute: reconcile with `hasReadyWork=false` ⇒ no effect (planted `true` ⇒ 1 wake — the
   leg must be able to fail).
5. Claim then withdraw attempt ⇒ no `removeMessage` effect (already claimed is untouchable).
6. Unclaimed withdraw ⇒ exactly one `removeMessage(messageId)`, and never for a message this slot did not
   author (foreign `messageId` refused).
7. Stop / Team close / dispose at every non-terminal phase ⇒ `suspended`, and every later event refused
   (A6-SF-10).
8. Restart fold, one leg per crash window in the table above, plus "restart with a slot in every phase"
   (7 slots, exact expected actions).
9. Concurrent release vs new request (A6-SF-07): the CAS loser gets a lost-CAS outcome, recomputes, and
   the outcome is exactly one wake — asserted over all interleavings of a small event set, not one lucky
   order. **Including the creation race**: two first-time requests for the same triple, both seeing "no
   slot", contend on the one key derived from that triple (the §2 store-key law), so exactly one slot
   survives. Without that keying this leg cannot fail, which is the round-3 finding.
10. Stale-epoch callback after handoff ⇒ `STALE_GENERATION`, slot unchanged (fencing).
11. No-progress: identical pending-work fingerprint for N cycles ⇒ `backoff` then `suspended`, and the
    wake count stops growing (the storm bound).
12. Determinism: same event sequence twice ⇒ byte-identical slot and effect list; `wakeId` literal pinned.
13. Hygiene/dormancy, same shape as PR0: exact file set, no protected imports, no clock/IO tokens, no
    consumers, both tsconfigs name the lane, plus its own p4t6 booking.
14. **Re-arm after a trusted false negative** (round-3 finding (c)): drive `reconciling` with
    `hasReadyWork=false` ⇒ `idle` with zero effects; then feed one `request` for the same triple ⇒ the slot
    reserves and emits exactly one `deliver-wake`. Pins the recovery path of a liveness hole the kernel
    cannot see (§4), so the hole costs latency and never costs the flight.
15. **Slot brand** (the PR0 lesson applied before it is ever learned the hard way here): a hand-built
    `WakeSlot` object — including a look-alike made by spreading a real hydrated slot, and one made by
    copying property descriptors — is refused with the unbranded code and changes nothing. The attack this
    pins is specific and worth stating: `withdraw-wake` carries an exact `messageId` an adapter will delete,
    so an unvalidated slot would be a plugin deleting a message it never authored.
16. **Mis-routed event refused**: every event carries the slot triple it is about; an event whose key
    differs from the slot it is applied to is refused and changes nothing. `wakeId` is derived from the
    triple, so a kernel that trusted a mismatched key would route a wake to a reviewer that never asked.

## 6. Explicitly out of scope for PR3′ (so "done" cannot drift)

Delivery (`deliverReviewWake`), `followup`/`steer` choice, `source.kind='plugin:dsh-agent-team'`
attribution, real `inbox.remove` calls, host event subscription, and the `PendingWorkSource` implementation
— all PR-I2/PR-I1 territory and all protected-file territory. Multi-writer lease ownership is *not*
claimed: the kernel refuses stale epochs, which is fencing at the state level, and the design source's
warning stands — a process-local Map is not a production single-writer guarantee, so the product must
either guarantee one writer or the lease owner comes from storage (a real-host obligation, disclosed in
S0-D condition C2 as ENV_BLOCK on this machine).

Also out: `team_review_defer`, UI states, metrics. They are named in the design source's later sections
and land with the productization PRs, not with a kernel that nothing calls yet.

## 7. Implementation status (written with the code in the tree, not before it)

This section is part of the same commit as the implementation, which matters for one honest reason: the
round-3 design amendments above — the store-key-is-the-triple paragraph in §2, the event-ingress trust
declaration in §5.4's neighbourhood, the false-negative liveness window in §4 and matrix legs 14–16 — are
**not** in `3e1d28464`. They land here. Anyone reading the earlier commit sees the pre-review design.

Shipped, dormant, in `packages/runtime/review-wake/`: `types.ts`, `identity.ts`, `slot.ts`, `recovery.ts`,
`index.ts`, plus `packages/runtime/test/a6-pr3-wake-kernel.test.ts` (**73 legs**, matrix 1–12 and 14–16) and
`packages/runtime/test/a6-pr3-lane-hygiene.test.ts` (**14 legs**, matrix 13). Both tsconfigs name the lane;
`packages/testkit/test/p4t6-bookings/alpha6-pr3.json` books the seven files (census 1402 → 1409, measured by
moving the bookings aside and reading the leg's own arithmetic).

Three things the implementation settled that the design left open:

1. **A takeover advances `revision` twice** (re-bind, then transition). Deliberate: recording a new
   `(leaseEpoch, writerToken)` requires minting a branded slot, and the CAS contract is on the revision the
   adapter *loaded*, not on the size of a step. Leg 10 pins monotonicity and refuses a stale writer, and
   says out loud that pinning `+1` would be pinning an implementation detail.
2. **Backoff is `min(base * 2^(n-1), cap)`** — the first wait is `base`, not `2·base` — with the shift
   clamped, because an unclamped shift on a long-failing slot overflows into a *negative* deadline, which
   means "wake immediately, forever": the storm the function exists to prevent, arriving through arithmetic.
3. **Hydration recomputes `wakeId` instead of trusting the row.** A stored row is the kernel's only memory
   of which wake is outstanding, and every correlator matches on that id, so a row naming another triple's
   digest is a slot that would re-deliver a pointer belonging to a different reviewer instance. The lane's
   law is that a wake id is derived and never carried; `hydrateWakeSlot` now enforces it. The consequence is
   stated rather than hidden: a refused row leaves the adapter with **no** slot, so corruption degrades to
   the `WAKE_NO_SLOT` path (a fresh `request` may open a new slot at `wakeSequence` 0, and a much older
   unclaimed message could in principle carry a digest that a new flight re-derives) — which is an orphaned
   *notification* with no authority in it, reported by the fold as `orphanFacts`, and not an authority
   event. That is the fail-closed direction this lane chose: re-read cheaply, never notify the wrong person.
4. **Budget exhaustion is a suspension, not a refusal.** `WAKE_REDELIVER_BUDGET_EXCEEDED` was in the
   vocabulary and no event could produce it, so it is gone rather than documented: dead vocabulary in a
   closed list is the finding PR0's round-3 review made about a sibling package, and this lane caught it
   with the same reachability leg (the kernel spec pins the *produced* set against the published one —
   importing `WAKE_REFUSALS` rather than copying it, because the first version's hand-typed copy drifted
   within the hour and still named the deleted code).

Unchanged, and still the two things C1 cannot reach: the Kv adapter's real cross-process CAS atomicity, and
the truth of `hasReadyWork` / inbox facts. Both are **C2 at the final merged HEAD** — re-run there, on a
single-owner machine, before anything in this lane is wired to `allow`.

### Round-4 review disposition (independent reviewer, executed not read)

Verdict on the stack `fd6c08ddd + 92fef05c8 + ab56a5146`: **safe to merge DORMANT**, from an
18-sequence external attack suite and an 11-mutation battery run against mirrors of the committed
blobs — 10 of 11 mutations turned at least one leg red. The one that survived, and the two things
closed out of it:

* **NEW-2 (minor, fixed here).** `recovery-observed` with `inbox='unclaimed'` and no `messageId` was
  refused at runtime and pinned by nothing: deleting the guard left the whole suite green. One leg now
  owns it, with the adopt-with-id case as its positive control.
* **NEW-3 (minor, fixed here).** §2 claimed the store key came from "one exported function" and no such
  export existed — the key was derived inside the test, i.e. the atomicity story had no shipped anchor.
  `wakeSlotRowKey` is now that export, the CAS model in leg 9 uses it, and a leg pins its
  order-sensitivity and its resistance to the `a:b:c`-join collisions a hand-rolled key would hit.
* **NEW-5 (note, fixed here).** The booking's leg counts are prose; what the census machine-enforces is
  the path set and the delta arithmetic. The booking now says which is which, because a note that reads
  like a guarantee and isn't one is the same species of error as a test that copies a vocabulary.
* **Carried to PR-I2, not fixed here:** host-facts-only ingress (already in §5) and the withdraw journal
  above.
