# P7-T2 design note — runtime mutation boundary + provenance

Task: P7-T2 (R47) — model/tool/permission/skill/MCP future-boundary mutation,
PolicyState, Autonomy Overlay, Human Override provenance.
Acceptance: "Effective Configuration 每项有来源，非法 escalation 被拒"
(every Effective Configuration cell carries a source; every illegal
escalation is rejected).

## 1. Module layout and port surface

- `packages/runtime/mutation/`
  - `types.ts` — `StoredMutationRecord` (durable admission record;
    `member: MemberIdentity | null`), `MutationLedgerEntry` (append-only
    provenance entry; `recordKind: MutationRecordKind | 'policyStateTransition'
    | 'creationField'`), `SuppressionRecord = SuppressedOverlayRecord &
    {recordedAtStep}`, and the injected ports: `StepClock`
    (currentStep/advance), `MutationStore` (records / transitions / ledger /
    creation-fields; append-only ledger), `PolicyReader` (blueprint /
    external / template views).
  - `errors.ts` — `MutationError` with a closed code set:
    MALFORMED_MUTATION_INPUT, MEMBER_SELF_ESCALATION, LEADER_OUT_OF_ENVELOPE,
    IDENTITY_SCOPE_MISMATCH, EXTERNAL_HARD_REJECTED, UNAUTHORIZED_TRANSITION,
    IMMUTABLE_CREATION_FIELD, UNKNOWN_INSTANCE.
  - `envelope.ts` — autonomy-envelope item projection
    (`memberEnvelopeItems` passes `external: {hard:{}, capabilityExists:{}}`;
    `teamEnvelopeItems` is undefined when no members are registered) and
    `checkAgainstEnvelope` (details `{capability, items, envelope}` sorted).
  - `service.ts` — `MutationService`: `registerInstance`,
    `requestMutation`, `switchPolicyState`, `beginStep(member)`,
    `resolveEffective(team, member, atStep?)`.
  - `index.ts` — explicit re-export lists (verified non-duplicative; an
    earlier "duplicate export" concern was a false alarm).
- `packages/runtime/policy-adapter.ts` — pure assembly bridging the durable
  ledger into the frozen domain resolver input shape:
  `assembleEffectivePolicyInput`, `latestEffective(records, effectiveFromOf,
  atStep)` (last-in-admission-order with `effectiveFromStep <= atStep`),
  `assembleOverlay` (per-capability last-write-wins),
  `assembleHumanOverride` (instance-scoped wins over team-scoped per
  capability), `activePolicyState(transitions, atStep)` (latest effective
  transition else `{stateId:'default'}`).

Zero upstream coupling: no `node:` builtins anywhere in the new sources
(import-face scan: 13 .ts files, 0 hits — see attempt1-post.log). All
behaviour is pure frozen domain (`packages/domain/policy`, read-only) plus
injected ports. CORE PATCH BUDGET = 0 honoured.

## 2. Provenance model

- `resolveEffective` produces, at (teamSessionId, member, step), a deep-frozen
  Effective Configuration: the frozen two-stage resolution output
  (`P_TeamResolved` over blueprint < policyState < template <
  templateOverlay < instanceOverlay < humanOverride, then
  `P_externalHard ∩ P_capabilityExists ∩ P_TeamResolved`) plus
  `contributions` (ledger entries with `effectiveFromStep <= step`,
  admission order) plus `suppressed` (lazily recorded overlay suppressions).
- Every effective cell carries its source: layer, origin, recordId,
  overriddenLower, note/explanation. `'unspecified'` appears only when NO
  Team layer specifies the cell (asserted in p7t2-provenance).
- Per-capability history: filter the ledger by capability (+recordKind) to
  walk the full change chain for one cell (asserted: exactly one ledger
  match per admitted record per capability/recordKind).
- Slot-level assembly: the assembled overlay/override slot id is the LATEST
  contributing durable record overall (one id per slot, per kind/scope);
  per-capability contributor identity lives in the provenance ledger, not in
  the slot id. This is asserted directly in p7t2-policy-state (r3: the
  instance slot id drifts to `memberTools` once it joins the slot while the
  model cell still cites `memberModel`) and in p7t2-future-boundary (s1).
- Suppressions are recorded lazily at resolution time. Dedupe key is
  `capability|layer|policyStateId` — NOT overlayId: slot ids drift whenever
  a new record joins the slot, so keying on overlayId re-recorded the same
  logical suppression once per drift. The recorded record keeps the slot id
  it had at first recording.

## 3. Mutation boundaries (all tested, including every negative)

- `registerInstance`
  - unknown creation field → MALFORMED `{field:'field'}`;
  - value rules (non-empty, <= 255 chars, no control chars) →
    MALFORMED `{field:'value'}`;
  - duplicate instance → MALFORMED `{field:'instance'}`;
  - writes two ledger entries (origin `static`, kind `creationField`,
    `requestedAtStep` 0, `effectiveFromStep` 1);
  - `contextPolicy` IMMUTABLE after creation
    (`{rule:'immutableAfterCreation'}`); `workspace` admitted before first
    RUNNING, IMMUTABLE after first RUNNING
    (`{rule:'immutableAfterFirstRunning'}`).
- `requestMutation` (all five capabilities: model, tools, permissions,
  skills, mcp)
  - identity scope via `assertMemberIdentityInTeam(identity,
    teamSessionId)` (identity FIRST); cross-team →
    IDENTITY_SCOPE_MISMATCH;
  - closed capability set; value normalisation via
    `normalizePolicyEntry('value')` — item-level problems surface as
    `value.items` (duplicate items, non-string item, empty item);
  - overlay origins restricted to leader/member (human overrides are a
    separate path);
  - external hard is checked at INTAKE for ALL origins (including human) —
    EXTERNAL_HARD_REJECTED. This is deliberately stricter than the resolver
    stage-2 clip, which remains as a safety net for post-admission fact
    drift (the stage-2 drift is exercised in p7t2-override-precedence:
    `externalHardRemovedAll` / `capabilityMissing` / `externalHardDeny`);
  - envelope check applies to agent origins only: member may not exceed the
    member autonomy envelope → MEMBER_SELF_ESCALATION; leader may not
    exceed the team envelope → LEADER_OUT_OF_ENVELOPE. The leader envelope
    check is skipped when NO members are registered (there is no member
    envelope to escalate from — see deviations).
- `switchPolicyState`
  - member actor → UNAUTHORIZED_TRANSITION
    `{allowedActors:['human','leader']}`; member actor missing the `member`
    identity → MALFORMED `{field:'actor.member'}` (actor checks run BEFORE
    any id minting — rejected requests mint nothing);
  - state view normalisation (`normalizeStateView`): stateId must be an
    id-like string (no whitespace/control); closed capability keys on
    `cells`; a cell may only carry `{locked?, value?}` (extra field →
    `target.cells.<cap>`); non-`true` `locked` is silently dropped to
    no-lock (mirrors the frozen domain's `PolicyStateCellView`);
    `value` item problems → `target.cells.<cap>.value` (or `.items`).
- `beginStep` — team derived from `member.rootSessionId` (TeamSessionId =
  RootSessionId invariant); unregistered instance →
  UNKNOWN_INSTANCE `{instanceId}`; overlapping steps tracked (inflight set).
- Every stored boundary is `deepFreeze`d. `StoredMutationRecord.member` is
  stored as `null`, never `undefined`, because frozen records must be
  lossless JSON (`deepFreeze` throws PolicyResolutionError on `undefined`).

## 4. Id minting

One shared numeric counter per service instance (class field, ctor 0):
`mintId(kind)` = `p7t2-<kind>-<n>` on the shared counter. Two mints per
admission call — `registerInstance` (ledger x2), `requestMutation` (record
+ ledger), `switchPolicyState` (transition entryId + ledger). Fresh-world
sequence: register → `…-1`,`…-2`; first mutation record → `…-3`;
second → `…-5`, etc. Validation precedes minting: rejected requests mint
nothing.

## 5. Deviations and recorded decisions

- Suppression dedupe key changed from `overlayId` to
  `capability|layer|policyStateId` (slot-id drift rationale above); this
  was required to keep the suppression trail at its logical length
  (2 instead of 3 in the policy-state scenario).
- External hard rejected at intake for ALL origins (stricter than the
  resolver stage-2 clip; the clip remains as the drift safety net).
- Leader envelope check skipped when no members are registered.
- Team-scoped human overrides apply to every member and mask their member
  overlays. The escalation test therefore scopes the beyond-envelope
  human grant to alpha only, so beta's template-layer check stays
  observable.
- A template VALUE cell (even deny) sits ABOVE a policyState value cell in
  the frozen layer order (blueprint < policyState < template). The
  policy-state fixture omits `mcp` from the alpha template so the pinned
  `policyState` value cell (`mcp: allow('c-a')`) wins; blueprint keeps
  `mcp: deny()` below it.
- `locked` not exactly `true` normalizes to no-lock (lenient, mirrors the
  frozen domain); malformed state views are rejected at intake before
  anything is stored.
- Fake-store boundary hygiene: `getCreationFields` returns a defensive copy
  (the internal row stays mutable — the running flag flips at first
  RUNNING — and must not alias caller-held snapshots); `list*` return live
  arrays, so tests copy (`[...listLedger(…)]`) at capture time when
  asserting historical state.
- Baseline first pass hit a transient ENOTEMPTY (environmental); the clean
  re-run is the recorded baseline (1399/1399, see attempt1-baseline.log).
- p4t6 scanner expectation updated 381 → 394 (N = 13 new files: 5
  `mutation/*.ts` + 1 `policy-adapter.ts` + 7 test files incl. the
  helper). `withSource` (9) and the legacy adapter count (4) unchanged.

## 6. Acceptance mapping

- "每项有来源" (every cell has a source): p7t2-provenance asserts every
  effective cell's layer/origin/recordId/overriddenLower, a non-empty
  explanation for every cell, the full per-capability ledger chain,
  contributions in admission order (with the step-2 vs step-3 delta), and
  deep-freeze of the whole configuration.
- "非法 escalation 被拒" (illegal escalation rejected): p7t2-escalation
  covers every boundary negative — member self-escalation, leader
  out-of-envelope, cross-team identity, malformed values/items, unknown
  capability/field, human-vs-leader scope, external hard rejection — and
  p7t2-policy-state covers unauthorised transitions plus every malformed
  state view; p7t2-future-boundary covers the five-domain boundary and
  PolicyState lock/suppression interplay; p7t2-override-precedence covers
  human/leader/member layering with stage-2 external drift;
  p7t2-creation-fields covers creation-field immutability and unknown
  instances.

Test totals: 111 new tests across six suites
(16 future-boundary + 40 escalation + 12 override-precedence + 18
policy-state + 13 creation-fields + 12 provenance); full chain 1399 →
1510, 0 failures.
