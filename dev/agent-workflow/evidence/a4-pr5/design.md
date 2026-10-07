# A4-PR5 design — durable permission mutation proposals + inline approval

Base: `origin/master @ a90a3040`. Files: exactly the Task 5 `Files:` list (see PR body for
deviations/reports).

## 1. Law placed in `packages/runtime/governance/permission-approval.ts` (pure lane module)

- `permissionMutationProposalFingerprint(input)` = `mutfp-` + SHA-256 (hex) over
  `canonicalJsonStringify` (contracts) of the frozen input
  `{ v:1, teamSessionId, targetMemberInstanceId, beneficiaryAuthority, mutationKind,
     rules:[{operationClass, matcherKind, matcherResource, effect} sorted], blueprintContentHash: string|null }`.
  Binds mutation identity + canonical matcher roots + requested effects + beneficiary +
  bound-Blueprint anchor. **Excludes** `mutationId` and `reason` (spec §24.5 provenance law),
  base pair, actor, clock. Digest: `sha256Hex` from `domain/blueprint` (self-contained, like the
  Blueprint hash), NOT storage's non-crypto `deterministicToken` (no new lane storage edge).
- `permissionMutationCorrelation({ baseGeneration, baseSnapshotId })` — base-pair-only token;
  correlation participates in the derived `approvalCaseId`, so the SAME semantics at the SAME
  base land on the SAME case (denied cases stay discoverable — A1-9); a new base generation is
  the only same-fingerprint re-ask (a new case).
- `beneficiaryAuthorityForTarget(memberInstanceId, contextBeneficiaryAuthority)` — the target
  position is DERIVED server-side: `LEADER_INSTANCE_ID` → `leader`, else the ceiling context's
  value. The production ceiling reader hardcodes `member` (reported need #1, `permission-plane.ts`
  is not a PR5 file); PR5 must not route leader self-mutations through a mislabelled beneficiary.
- `planPermissionMutationApproval(...)` — required-rung walk per rising region via
  `evaluateAuthorityCeiling` (grantCeiling walk from `rungAbove(beneficiary)`), batch
  `requiredAuthority` = max rung over the regions, `requestedEffect` = max risen effect;
  an `undetermined` region ⇒ `status:'undetermined'` (refusal, never a guessed rung);
  insufficient detail's `requiredAuthority='human-admin'` ⇒ legal plan, terminated later by
  `requestApprovalLeg`'s A1-12 branch (no production admin resolver).
- Rise digest law (`riseDigestOf` / `encodeRiseSummary` / `parseRiseSummary`): digest over the
  sorted multiset `[(operationClass, region kind+resource, risenEffect)]`; carried in the approval
  leg's `summary` as `pmut-rise:<hex>` — durable, read-back at commit. Region-set law
  (spec §8): a matcher ROOT retarget changes a region identity ⇒ digest drifts ⇒ stale; a
  descendant change under the same root that leaves every approved region's rise identical does
  not; a NEW rise region or a moved before/after ⇒ not covered by the approval ⇒ stale.
  Unparseable summary at commit ⇒ stale (fail-closed, never a silent widen).
- `PERMISSION_MUTATION_PENDING_REASON = 'mutation-proposal-pending'` and
  `PERMISSION_MUTATION_TERMINAL_OUTCOMES` — a governance-local MIRROR of
  `intervention/derivation.ts` `TERMINAL_MUTATION_OUTCOMES` (executing paths must not import
  `intervention/**`, A1-17 posture); containment pinned by test, never a re-spelling of intent.

## 2. Result union (governance/types.ts, additive)

Existing arms unchanged (`changed:true` | `no-change`). New arms, all `changed:false`:
`reason:'mutation-proposal-pending'` (+ approvalCaseId, requestId?, requiredAuthority,
proposalFingerprint); terminal arms `mutation-stale | denied | authority-unavailable |
authority-undetermined` (+ detail, approvalCaseId?, current). The terminal strings are exactly
the frozen `TERMINAL_MUTATION_OUTCOMES` values.

## 3. Service orchestration (`service.ts`, inside the serialized section)

- Injection point: the PR2 ceiling-gate site (`authorizeCeilingBoundedPermissionRise`). The gate
  law itself is UNTOUCHED; when it throws `AUTHORITY_CEILING_INSUFFICIENT` AND the approval lane
  is wired (`deps.permissionApproval` + `deps.proposals` + a derivable approval caller), PR5
  catches that ONE code and enters the proposal path. Unwired ⇒ byte-identical PR2 throw
  (v1/v2 teams and test worlds are untouched — pinned by the existing suites staying green).
  `AUTHORITY_CEILING_UNDETERMINED/UNAVAILABLE` rethrow unchanged (fail-closed input facts).
- Member initiation: refused at 2a, OUTSIDE the chain, before any proposal machinery (RED-pinned).
- Proposal path (fresh): identity = derived case with `mutationProposalFingerprint` + base-pair
  correlation, subject `{kind:'instance', instanceId:target}`, kind `envelope-mutation`,
  `executionCoupling:'inline'`, caller = leader → `{kind:'instance',instanceId:LEADER_INSTANCE_ID}`;
  operator → the additive `approvalCaller` arg (s6-remote threads the DERIVED principal; absent ⇒
  lane behaves unwired). `findApprovalCaseByIdentity` FIRST (kind passed explicitly): found ⇒ no
  rows; none ⇒ append one `governance-proposal-recorded` row per rule (PR0 store, grouped by
  `caseFingerprint` = the fingerprint) then `requestApprovalLeg`. `requiredAuthority='human-admin'`
  ⇒ NO proposal rows, born-terminal leg (A1-12 amended F2), result `authority-unavailable`.
- Retry path (case discovered): open ⇒ pending arm (idempotent, zero new rows); decided-allow ⇒
  inline commit revalidation IN THIS ORDER, all zero-write until the final append:
  lifecycle re-guard (drift ⇒ stale), base pair (proposal row base vs current latest ⇒ drift ⇒
  stale), re-plan (`!changed` ⇒ no-change arm — desired already reached), planned-rule equality +
  rise digest equality vs the leg summary (⇒ drift ⇒ stale), recomputed required ≤ approved
  `reviewAuthority` (documents narrowed ⇒ stale), then ONE `overlay.append` (commit-before-ack;
  durable duplicate ⇒ GENERATION_CONFLICT as today). Decided-deny (not escalated) ⇒ `denied`.
  Deny with reason `escalated` and no risen leg ⇒ `authority-unavailable` ("the rise failed" —
  never "awaiting <successor>"). Status `abandoned` ⇒ terminal `mutation-stale` (disclosed
  vocabulary choice: the approval is not live and same-base re-ask is not the recovery; the
  frozen outcome set has no abandon bucket).
- ApprovalCaseRead/Identity problems from the control plane propagate typed (never collapse).

## 4. Wiring (root.ts; s6-remote.ts)

- root.ts: `createGovernanceProposalStore({ ledger: repos.ledger, now })`; approval port =
  late-bound `controlServiceRef.current` adapter (same pattern as host), passed into
  `createGovernanceMutationService` as `proposals` + `approval`. Governance imports only
  `control/types.js` TYPES (type-only), never `control/service.ts`.
- s6-remote v7 seam: terminal arms pass through the closed `{changed, code?, reason?}` projection
  honestly; the PENDING arm THROWS typed ("v7 remote seam carries no proposal outcome — zero
  write") instead of silently degrading to `changed:false`. Remote contract stays v7.
- The tool lane (`permissionLaneMutate` → mutation-lane → governance) passes results through
  verbatim — the pending arm reaches the tools plane as data. `packages/tools/src/tools.ts`
  consumption is PR4's file: NOT edited (reported need); `tools/types.ts` needs no change
  (result is `Record<string, unknown>` passthrough).

## 5. Disclosed interim positions

- Proposal rows render as generic Events until PR6 (A5-7), same posture as PR3's disclosure.
- `blueprintContentHash` ceiling-context binding: PR5 binds the anchor when the context reader
  provides it (lane tests do); production reader supply needs the reported `permission-plane.ts`
  change — until then production fingerprints carry `blueprintContentHash: null` (a distinct
  bound value, never a silent skip).
- `targetGuard` in production is the plane's leader-aware lifecycle assertion; archived-at-commit
  ⇒ stale (A1-13) is enforced by re-running that same guard at the commit boundary.

## 6. Adjudications settled during implementation (with the law each renders)

- **Base drift is a FRESH ask, not a resume.** The correlation names the base pair
  (`pmut:g<generation>:<snapshotId|none>`), so at a moved base discovery cannot find the old
  case at all — the retry opens a fresh case at the NEW base and the allowed-at-old-base case
  never commits (lane B). An explicit `expectedGeneration` pinned at the approved base is a
  pre-CAS typed `PERMISSION_OVERLAY_GENERATION_CONFLICT` with zero writes (lane B).
- **Lifecycle-drift reinterpretation is exactly one arm.** With the approval lane wired, a
  `targetGuard` refusal is re-read ONLY when discovery finds a DECIDED-ALLOW case for the same
  identity — then it answers `mutation-stale {problem: 'target-lifecycle-drift'}` (the approved
  commit can no longer address its target). Every other lifecycle refusal propagates byte-
  identical (proposal creation on an archived target still throws BEFORE any row — lane B pins
  both arms).
- **Two different human-admin situations.** A BENEFICIARY at `human-admin` is a malformed
  input (the walk starts above the beneficiary; nothing sits above admin) —
  `planPermissionMutationApproval` lets the evaluator's `BINDING_DEFECT` throw stand. An ASK
  whose `requiredAuthority` is `human-admin` (capped hard envelope) is representable: the leg
  is born terminal (A1-12 amended F2) and the mutation answers `authority-unavailable` with
  ZERO proposal rows and zero pending promise (lane A unit + e2e).
- **The retarget law.** The commit boundary compares the FRESH rise digest against
  `parseRiseSummary(state.legs[0].summary)` — the digest is read from the FIRST leg because
  escalation legs may not carry the summary. Containment-retarget under the same canonical key
  changes the rise structure but not the fingerprint; the digest check is what makes that
  stale (mutation-proven: flipping the digest check reddens `matcher ROOT drift`).
- **Escalated deny renders "rise failed".** A denied case whose decision reason is
  `CONTROL_DECISION_REASONS.ESCALATED` maps to `authority-unavailable` (never "awaiting a
  successor" — there is no successor in Alpha.4); any other deny maps to `denied`. Abandoned ⇒
  `mutation-stale`; an unreadable case read ⇒ `mutation-stale` (never a silent re-open).
- **Vocabulary, locked:** pending reason `mutation-proposal-pending`; terminal arms
  `mutation-stale | denied | authority-unavailable` (+ `authority-undetermined` in the
  vocabulary constant with NO entrance — nothing in the gate path can produce it as a result);
  fingerprint `mutfp-<64hex>`; correlation `pmut:g<N>:<snapshotId|none>`; summary
  `pmut-rise:<64hex>`; proposal operation id `op-<32hex>` derived from the mutationId
  (deterministic — a crash-retry names the SAME store operation).
- **s6-remote seam (SUPERSEDED BY §8 — kept for the record; the shipped design is
  §8's honest carry):** the first design had the pending arm throw
  `PERMISSION_MUTATION_APPROVAL_PENDING` (a plain Error + `code`, the
  `permissionEntryUnwired` precedent) because the closed v7 projection
  `{changed, code?, reason?}` would hide the only handle that decides the case.
  Measurement through the real throw-proof dispatcher killed it: a code outside the
  closed `REMOTE_BACKING_ERROR_CODES` vocabulary arrives as `INTERNAL_ERROR` — an
  approval lost on the floor. Shipped instead: `changed:false` + reason
  `mutation-proposal-pending` on the existing reason slot; the case HANDLE stays off
  v7 by the closed field set but is genuinely RECOVERABLE over v7 — `getProjection`
  counts and `getLedgerPage` payloads carry the proposal rows and the approval case's
  identity, and the ask's identity correlation is deterministic (§8). This departs
  from plan:459's "PR5 refuses a proposal outcome typed at the v7 seam": a TYPED
  refusal at the seam was measured to be the less honest option, and the deviation
  is disclosed in the commit message.

## 7. Mutation-proof ledger (production flipped, lane observed, production restored)

RED-under-flip (law pinned by a test): discovery-first interpretation (`denied is terminal`);
approved-rung bound (`ceiling NARROWS after approval`); escalated-deny mapping (`the rise that
failed`); rise-digest readback (`matcher ROOT drift`); correlation base pair — snapshot drop
(`names only the base pair`); lifecycle reinterpretation (`lifecycle drift: archived target`);
beneficiary-from-target (`derives the leader position from the TARGET identity`); batch MAX
rung (`the batch is the MAX rung` — the original uniform-rung fixture did NOT discriminate
first-vs-max; it was upgraded to a mixed batch [silent-carrier → leader, hard-capped →
human-admin] ordered so first and max disagree, and the flip then reddened it); requested-effect
precedence MAX (`names the first approval rung`).

Flips that stayed GREEN, disclosed honestly:
- Rescuing ALL gate codes (not just `AUTHORITY_CEILING_INSUFFICIENT`) into the approval path:
  still refuses — the unreadable/capped documents re-throw inside `buildApprovalAsk` and the
  ask-undefined rethrow-of-cause returns the ORIGINAL typed error. The refusal law is doubly
  guarded; the code-equality check alone is not observable through the public surface.
- Removing the within-section fingerprint equality: no in-window test (the drift it guards is
  an async blueprint-rebind BETWEEN two reads inside one serialized section; no fixture
  interleaves it). Defense-in-depth, disclosed as unenforced-by-test.
- Loosening `parseRiseSummary` to `<64` hex: the commit stays stale anyway via the digest
  mismatch (grammar + digest are backstops for each other; grammar itself is unit-probed).

## 8. Corrections (parent verification round at 433811ff — measured facts outrank claims in both directions)

- **Client lane: the writer's "zero failures" was WRONG; the acceptance number is the lane's
  own run.** The root `pnpm test` lane does not execute `packages/client`'s suite (the
  `packages/client/test` matches in the root log are the p4t6 scan inventory, not executed
  tests — the misread this round). The scoped client lane, re-run and reproduced at this head:
  **`3 failed | 853 passed (856)`**, the three pre-existing failures being
  `team-creation-panel.client.spec.tsx` × 2 (blueprint-detail persona-fact probe; runtime-preset
  re-probe) and `team-governance.client.spec.tsx` × 1 (override reset, scope instance).
  Nothing to fix in code — the record stands corrected; a lane that happens to pass elsewhere
  is not the acceptance measurement.
- **The s6 pending-arm design was CHANGED by the same rule.** The first implementation threw
  a typed `PERMISSION_MUTATION_APPROVAL_PENDING`; the parent's grep (`0` test files could see
  that code) led to measuring the REAL throw-proof dispatcher: codes outside the closed
  `REMOTE_BACKING_ERROR_CODES` vocabulary (packages/remote/src/handlers/dispatch.ts — outside
  PR5 ownership) degrade to `INTERNAL_ERROR`, so the throw would have arrived as an anonymous
  crash — the approval-lost-on-the-floor class, self-inflicted. The seam now projects the
  pending arm through the closed `{changed, code?, reason?}` shape HONESTLY
  (`changed:false` + `reason:'mutation-proposal-pending'` — the same discriminator the PR2
  ceiling refusals already ride; the case handle stays off v7 by the closed field set, its
  recovery is the approval lane). Pinned by three new lane-B tests through
  `createS6RemoteDispatcher` (pending honest carry + closed key set; terminal `denied` carry;
  the DERIVED caller arrives as `approvalCaller`), each mutation-proven (dropping the reason
  carry reddened the arm tests; unthreading the caller reddened its test). The code
  `PERMISSION_MUTATION_APPROVAL_PENDING` no longer exists anywhere except this history note.
  NAMED FOLLOW-UP (not BLOCKED — the refusal class is gone): if a future PR wants the wire to
  SEE a pending case handle on v7, `packages/remote` owns adding the code/field to the closed
  vocabulary; until then the approval lane is the recovery path, by the closed field set.
- **Lint retirements, attributed (rule: retire only when this PR caused it and the message
  says so).** The two retiring identities on `packages/runtime/governance/service.ts` are the
  PR2-visible-debt imports `PermissionOverlayRule` (now USED by the extracted
  `appendPlannedSnapshot(…, plannedRules: readonly PermissionOverlayRule[], …)`) and
  `LEADER_INSTANCE_ID` (now USED by the approval-caller derivation
  `actor === 'leader' ? { kind: 'instance', instanceId: LEADER_INSTANCE_ID } : …`). The
  imports were not deleted — they gained real consumers, so the identities retire truthfully.
  The THIRD debt import, `type PermissionStaticLayerFacts` (service.ts:117), is untouched and
  **still reports** (measured: `117:8 error 'PermissionStaticLayerFacts' is defined but never
  used` — 1 identity remains on the file, baseline 3 → 1).

## 9. Rebase round onto PR4 (`08e6ab6c`, PR #91) — parent follow-up items, measured

- **Rebase.** One commit, hygiene conflicts (4 hunks) resolved as SET UNIONS of the
  PR4 and PR5 consumer rows; dist co-committed after a full rebuild.
- **p4t6 (pin owned).** `SCANNED_PATHS_A4PR5` names exactly the four PR5 files; the
  total is DERIVED (`983 + PR2 + PR3 + PR4 + PR5.length`), the tie is
  `SCANNED_PATHS_A4PR5.length === 1003 - 999`, presence per path, nothing renumbered.
  The owed number moved from "999" (the pre-PR4 arithmetic in the instruction) to
  **1003** by measurement: PR4 legitimately added its own four named files to the
  same derivation (RED-D01 recorded `expected 1003 to be 999` at the raw rebase).
- **Plane wiring (item 1).** `createAuthorityCeilingReader` (the ONE reader, A5-12 —
  PR4's `OperationApprovalCeilingPort` is its structural subset, so both lanes got
  the fix) now (a) derives `beneficiaryAuthority` through `beneficiaryAuthorityForTarget`
  — the same law the governance ask path applies, stated by name in the hygiene leg;
  (b) carries `blueprintContentHash` from the SAME bound-Blueprint resolution that
  chose the v3 branch, so the proposal fingerprint anchors to the durable content
  identity; (c) a v3 read whose binding resolves WITHOUT a hash answers NO context
  (the documented unresolved-binding branch) — an anchorless production fingerprint
  is unreachable, and the anchor group in lane A pins anchored ≠ null-anchored
  fingerprints forever (bound vs skipped, distinguishable by construction). The PR2
  reader-fixture spec grew the fact getter only; its legs are untouched.
- **Duty (a) guard-side A1-14 — BLOCKED, named, with the exact seam.**
  `BLOCKED(pr5-a1-14-guard-side): recheck-before-consumption inside guardOperation is
  not derivable at the guard seam.` Measurement, not assumption: the recheck law
  (`routeOperationApproval`/`recheckOperationApproval`) is a function of the operation's
  RESOURCE identity (class + canonical resource key); at the consumption seam that
  identity does not exist in ANY structure the guard can read — `ControlOperationScope`
  (control/types.ts:753-793) carries only the instance-identity namespace plus the
  OPTIONAL `operationFingerprint` (for file ops `key = exact:<path>` while the
  fingerprint is the payload identity — not interderivable); the durable request/case
  rows carry neither; `requestApprovalLeg`'s input carries no resource key either
  (checked field by field). Injecting `createOperationApprovalFactsReader` into
  `ControlServiceOptions` would therefore yield either a vacuous port (always 'ok' —
  claimed enforcement that does not exist) or a mass denial of every pre-existing
  flow (always 'undetermined'). The honest close is a CONTRACT change: extend the
  scope/row identity to carry the operation resource identity (an A1-9/A1-14 identity
  surface that re-keys durable approvals) — owned by PR7's cutover, where the durable
  vocabulary closes anyway. Until then the adapter-side `(4c')` recheck stands (the
  only door that currently creates `reviewAuthority` rows), and this record names
  what remains unenforced: a consumption of an OLD allow through the raw
  `team_resolve_control` path after documents tightened.
- **Duty (b) escalate — IMPLEMENTED.** `{status:'control-escalated', outcome}` joins
  the closed `TeamToolsResult` union (`packages/tools/src/types.ts`);
  `team_resolve_control`'s decision enum and description stop advertising `allow | deny`
  only — `escalate` rides the SEPARATE `CONTROL_REVIEW_ACTIONS` axis (A2-1 holds: no
  fourth `CONTROL_DECISION_VALUE`), routed to `escalateApprovalLeg`, never to
  `resolveControl`. Four measured legs in the tools c1 spec: the reviewer escalates
  through the tool (arm honest: risen leg `leader -> human-user`, terminal
  `deny(reason escalated)`, escalation fact names the escalating PRINCIPAL and the
  closed leg); a MEMBER is refused (`CONTROL_RESOLVER_NOT_AUTHORIZED`, zero-write — the
  leg survived for its leader) — **"a member can escalate" is now an EXAMINED
  assumption with a measured answer: NO member is the reviewer of any current kind, so
  no member leg exists to escalate**; garbage decisions refuse naming all three arms;
  pre-Alpha.4 rows keep their closed refusal.
- **Authorized deviations from the PR5 `Files:` list (parent instruction items 3-4):**
  `src/plugin/permission-plane.ts` (the wiring itself), `packages/tools/src/types.ts` +
  `packages/tools/src/tools.ts` (duty b), `packages/testkit/test/p4t6-session-event-scan.test.ts`
  (the pin), `packages/runtime/test/a4p2-dual-envelope-mutation.test.ts` (fact-getter
  interface growth only), `packages/tools/test/c1-list-pending-control.test.ts`
  (duty-b legs). No other file outside the original list was touched; `control/` is
  NOT among them (duty a closed BLOCKED before editing it).
- **The two doors (parent design-risk question).** Adjudicated and pinned (lane B,
  'the two approval doors never share a case'): the door is chosen by the ENTRY, not
  the effect — a ceiling-insufficient grant mutation opens exactly ONE
  `envelope-mutation` case; an operation preflight opens operation-identity cases
  through PR4's adapter; the control identity law (`fingerprint-cardinality`,
  exactly ONE of operation/mutation fingerprints) makes a hybrid identity
  UNFORMABLE, so neither lane can forge, join, or double-open the other's case — one
  attempt is never behind two open cases. The two doors decide different objects
  (one-shot execution vs durable rule), each consumed on its own terms.

## 10. Review round (read-only review of `94868484`) — MERGE WITH CORRECTIONS, all seven delivered

1. **A2-16/A3-10 structural single-writer gate SHIPPED** (the owed duty): three clauses in
   `a3p3-governance-lane-hygiene.test.ts` — exactly one kernel `overlay.append(` in ALL production
   source AND it sits INSIDE `appendPlannedSnapshot` (brace-matched body CONTAINMENT, not the a4p2
   text-order `indexOf` which cannot see a site preceding the gate); the adapter as the kernel
   writer's only wrapper, instantiated in exactly one wiring (`src/plugin/host.ts`); no third call
   site anywhere in the scanned roots. Mutation-proven: a scratch third-writer file reddened
   clauses 1+3, removal re-greened. This ships in the PR that made it single-writer — PR5 added
   the second commit route, so the funnel's keeper is PR5's duty.
2. **The named-lies test is dead; two truthful tests replaced it.** The old
   `a4p5-inline-commit` "corrupt rise summary … fails closed (stale, zero write)" injected nothing
   and asserted `changed === true` — it made the service arm (unparseable/mismatched digest →
   stale) survivable in reverse. Now: a pure-probe test named for what it probes, plus TWO real
   arm tests injecting corruption at the PORT BOUNDARY (`summaryTamper`): an unparseable summary
   and a WELL-FORMED digest naming a different rise structure — both stale, zero write
   (A1-8 structural equality, not format). Mutation-proven: bypassing the arm reddened exactly
   those two.
3. **`governance/types.ts:274-282` corrected**: the "production plane reader does not supply it
   yet; every fingerprint built today is anchored `null`" paragraph contradicted the wired
   `createAuthorityCeilingReader` and the anchor tests; the doc now states the shipped law (v3
   always anchored or NO context; `null`-anchor reachable only from fixture readers).
4. **plan:459 deviation disclosed** (commit message + §6): the plan ruled PR5 would REFUSE a
   proposal outcome at the v7 seam; the shipped honest carry is `changed:false` + the named
   reason — measured strictly better than a typed refusal that would have degraded to
   INTERNAL_ERROR. **§6 corrected** to describe the SHIPPED design as §8's predecessor (the throw
   design is now labeled superseded, no longer stated as live). **s6-remote.ts:2985 comment
   corrected**: the case handle is genuinely recoverable over v7 — `getProjection` counts and
   `getLedgerPage` payloads carry the proposal rows and the case identity — the comment now names
   the read-plane route instead of understating it.
5. **Leg-then-proposals non-atomicity DISCLOSED in situ** (`service.ts`, before the append loop):
   two stores, one fault window; a mid-loop fault can leave a reviewable case with fewer rows
   than rules, and retry answers pending WITHOUT backfill (A1-9 idempotence must not become
   silent re-append). Authority unaffected (the commit boundary never reads row counts — fresh
   revalidation + digest + the durable-identity comparison); the AUDIT record can be permanently
   incomplete; closure (backfill-on-discovery or a shared append funnel) is a durable-shape change
   owned by the PR7 cutover.
6. **The lifecycle swallow is narrowed** (A3-3's class): the in-guard reinterpretation to
   `mutation-stale` now fires ONLY behind an injected `isLifecycleRefusal` decider owned by the
   guard's law (production: `error instanceof PermissionLifecycleError`, wired in `root.ts`
   beside `targetGuard` through the plane passthrough; absent = never reinterpret). A storage
   fault on the guard's stack propagates as ITSELF — measured: three new lane-B tests (fault
   propagates; lifecycle refusal STILL reinterprets; mutation of the narrowing reddens the fault
   test). The helper's own catch keeps propagate-original semantics, now documented as incapable
   of fabricating a verdict.
7. **The ten-minute set**: (a) the tautological fingerprint pair at the commit boundary is
   replaced by FIELD-WISE comparisons of the DURABLE case identity against both the pre-section
   ask and the freshly recomputed ask (`durable-identity-not-the-current-ask` /
   `identity-drift-within-section`) — the injected port's answer is verified, not trusted; a
   lying-reader test (identityTamper at the port boundary) pins it and mutation-proves it.
   (b) The dead `contextBeneficiaryAuthority` parameter is GONE from `beneficiaryAuthorityForTarget`
   — the one-argument signature is the law (the lane test asserts `length === 1`).
   (c) The §II nuance is disclosed in the approval-law module doc: dedup is PER IDENTITY;
   containment drift moving `requestedEffect` between two asks at the same base leaves the old
   case OPEN forever (unreachable, uncommittable, abandon-closable) — "one open case per
   (team, target, base)" is not literally guaranteed, named as such.
