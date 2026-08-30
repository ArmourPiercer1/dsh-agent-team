# P6-T3 — findings: documented semantics, rulings, deferred decisions

Everything here is a CLAIM by the P6-T3 leaf worker (attempt 1/3); the main
agent re-verifies against disk. Code: `packages/runtime/messaging/`
(coordinator.ts, errors.ts, index.ts, mediation.ts, types.ts); tests:
`packages/runtime/test/p6t3-{helpers,send-delivery,mediation,restart}.ts`.

## 1. The two-record split (Architecture §23/§24)

A `send-message` produces **exactly two record kinds** plus the ordinary
session input — and nothing else (invariant 42: NO Team-specific DSH
SessionEvent vocabulary is created anywhere in this task):

- **(A1) TeamDomain LEDGER row `team-coordination-recorded`** (the intent
  fact) — written by the P6-T2 facade's SEND_MESSAGE effect
  (`action-router/effects.ts`, the `commitFact` path) under the facade's
  per-team lock. Payload (closed set, facade-controlled): `action`,
  `caller` (ActionCallerRef), `targetInstanceId`, `recipientInstanceId`,
  optional `subject`/`body`, `requestToken`, `at`. It records WHO → WHOM
  with instanceIds and the correlation token; it is durable coordination
  state (invariant 41: the TeamDomain is the durable authority; invariant
  44: team-order comes from the TeamLedger sequence).
- **(A2) TeamDomain LEDGER row `team-message-delivered`** (the
  confirmation fact) — written by the P6-T3 coordinator after a successful
  delivery, through the same public ledger repository under the
  coordinator's per-team lock. Payload: `action`, `requestToken`,
  `factSequence` (the intent's sequence — the correlation),
  `fromHumanId` | `fromInstanceId`, `recipientInstanceId` (the INTENDED
  recipient), `deliveryMode` (`'direct'` | `'mediated'`),
  `deliveredToInstanceId`, `deliveredToSessionId`, `at`. It records the
  path ACTUALLY taken (ruling R1).
- **(B) The target Session's ordinary input** — the coordinator submits
  exactly one `AttributedSessionInput`
  `{sessionId, text, attribution}` through the injected
  `SessionInputPort.submitAttributedInput`. In unit tests the port is a
  recording fake; the REAL public Session input API is integrated at
  P6-T6 (deferred, §5). The relay text is EXACT:
  - direct: `[team-relay] from=${fromRef} to=${recipientRef}\n${subjectLine}${body}`
  - mediated: `[team-relay:mediated via leader] from=${fromRef} intended-for=${recipientRef}\n${subjectLine}${body}`
  - `subjectLine = 'subject=${subject}\n'` iff `subject` is present;
    `fromRef = 'human:<id>'` for humans, else `<instanceId>` or
    `<instanceId> (label: <label>)`; `recipientRef` is always the
    instanceId-first rendering.
  - The attribution is `{kind: 'team-relay', fromInstanceId? | fromHumanId?,
    intendedForInstanceId, correlation: {requestToken, factSequence}}` —
    the correlation ties the input back to the intent fact (A1).

Receiving a relay grants NO shared-history access to the sender's
session (Arch §24.2) — the recipient session receives an ordinary input
like any other.

## 2. The exact member→member mediation rule (documented in `mediation.ts`)

Input: the caller's identity (from the facade-validated `ActionCaller`),
the intended `recipientInstanceId`, and the LATEST instance-scoped
autonomy overlays of the SENDER (fresh `overrides.list`).

1. **human caller → `direct`** (to the intended recipient; invariant 34,
   humans are unbounded).
2. **leader caller → `direct`** (role `'leader'` or
   `instanceId === LEADER_INSTANCE_ID`; invariant 14/18).
3. **member → leader → `direct`** (upward coordination is never
   mediated).
4. **member → peer (another member instance) → `direct` IFF the sender's
   HIGHEST-GENERATION instance overlay strictly carries
   `values.messagingPeerDirect === true`** (key `PEER_DIRECT_GRANT_KEY =
   'messagingPeerDirect'`); otherwise **`mediated` via the leader**
   (`deliveredToInstanceId = LEADER_INSTANCE_ID`, reason
   `member-to-member-default-mediation`).
   - Grants are PER-SENDER: the SENDER's overlays only; the recipient's
     overlay state is irrelevant to the path.
   - Superseded (lower-generation) grants do NOT count; a newer
     generation without the grant REVOKES it (latest generation wins,
     fail closed on absence/malformation).
   - Mediation decides the delivery PATH only: the coordination fact
     (A1) always records the INTENDED recipient; mediation never rewrites
     coordination (Arch §24.2).
5. Authority ALWAYS beats mediation: envelope/quota/authority denials come
   from the facade BEFORE any delivery planning (a peer-direct grant in
   the same overlay as an `envelope.deny` of `send-message` still gets
   `TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS`, zero writes).

## 3. Rulings taken during implementation

- **R1 — the delivery plan is RE-DERIVED at delivery time from the durable
  intent + fresh governance state.** The facade's intent fact payload is
  a closed set (it does not persist extra request fields), so the
  coordinator re-runs `decideDeliveryPlan` on the durable intent at
  delivery/recovery. Consequence: an overlay written BETWEEN intent and
  delivery changes the delivery PATH but never the coordination; the
  confirmation fact (A2) records the path actually taken.
- **R2 — a delivery failure after the intent leaves the intent durable
  WITHOUT a confirmation = a pending delivery** (Arch §24.2: intent is
  ordered before delivery). The failed send resolves to
  `MESSAGING_DELIVERY_FAILED` with the intent fact as the only durable
  side effect.
- **R3 — restart recovery is EXACTLY-ONCE on the TeamLedger, AT-LEAST-ONCE
  on the session input.** A crash between the input write and the
  confirmation redelivers on recovery; the duplicate is detectable via
  the correlation token (same `requestToken`/`factSequence`).
- **R4 — dead/missing targets at recovery are SKIPPED with a closed
  reason** (`delivery-target-missing` = the resolved target instance no
  longer exists; `delivery-target-not-live` = lifecycle not in
  WORK_ACCEPTING_STATES) — no side effects; the intents stay pending and
  a later recovery (after the target is restored/live) redelivers them.
- **R5 — a recovery run ABORTS on the first hard failure** (the
  `MESSAGING_DELIVERY_FAILED` propagates out of `recoverPendingDeliveries`);
  earlier confirmations in the same run stay durable; a clean retry
  recovers ONLY the remaining pending intents.
- **R6 — the coordinator owns its OWN per-team lock map** (composing with
  the facade's separate lock map; both serialize on the same
  rootSessionId key), so delivery confirmation and the facade's fact
  commits never interleave within a team; ledger sequence order remains
  the team-order authority (invariant 44).
- **R7 — exactly two record kinds (A1, A2) + the ordinary attributed
  input are ever created; NO Team SessionEvents** (invariant 42 red line —
  enforced structurally: the module never imports any SessionEvent
  vocabulary, and the p4t6 denylist scan passes at 295).

## 4. Additional documented decisions

- **(a) Self-send is REJECTED — a defined policy.**
  `member/leader instance caller → its own instanceId` fails closed with
  `MESSAGING_SELF_SEND_REJECTED` BEFORE the facade call (zero writes; the
  human caller is exempt — a human has no instance identity to collide
  with). Documented in `coordinator.ts` (the `assertNotSelfSend` step).
- **(b) `team-message-delivered` is a new kebab-case ledger fact family**
  written through the public `LedgerRepository` (same path as the
  provider-owned facts from P6-T1). It is p4t6-safe (the denylist scans
  quoted Team-SessionEvent literals, not fact types) — verified by the
  295 scan.
- **(c) Facade `TeamRuntimeError` codes propagate UNMAPPED** (single
  authority for admission/authority/envelope/quota/addressing failures):
  `TEAM_RUNTIME_INSTANCE_NOT_FOUND`, `TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED`
  (details `kind: 'member-label' | 'template-id'`),
  `TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS`, quota codes, etc. The messaging
  layer adds its own typed `MessagingError` codes only for
  messaging-specific failures (malformed request, self-send, target not
  live at delivery, delivery failure, ledger write failure, internal).

## 5. Deferred / handed to the main agent

1. **P6-T6**: wire the injected `SessionInputPort` to the REAL public
   Session input API. Until then, delivery in tests lands on the
   recording fake; the coordinator is the only integration point.
2. **p4t6 cross-branch count convergence**: this branch asserts **295**
   (286 baseline + 9 P6-T3 files). The main agent converges the final
   count when other P6 branches land; only the test's number/comment/
   title change per branch (scanner `.mjs` + `legacy-vocabulary.ts` stay
   byte-identical — verified here).
3. **Write-cost calibration** (for future evidence): on a FRESH TeamDomain
   the first `ledger.allocateSequence()` performs the one-time sequence-
   counter bootstrap put (+1 seam write), so the first healthy delivery
   costs 5 seam writes (2 facts × 2 + bootstrap); every later fact costs
   exactly 2 (allocateSequence increment + put). All rejections cost 0.
4. **At-least-once session input (R3)**: deduplication of redelivered
   relays is the receiving session's concern, keyed by the correlation
   token; no dedup state is kept in the TeamDomain (keeps the ledger
   exactly-once).
