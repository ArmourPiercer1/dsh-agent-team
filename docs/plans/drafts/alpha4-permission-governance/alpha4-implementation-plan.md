# Alpha.4 Permission Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For the intended execution model, also use `superpowers:dispatching-parallel-agents` whenever a PR contains file-disjoint work lanes.

**Goal:** Implement the Alpha.4 runtime authority hierarchy, effective-ceiling envelopes, multi-leg approval routing, durable mutation proposals, intervention/warning surfaces, and final Blueprint-v3-only migration without making intermediate PRs unnecessarily unusable.

**Architecture:** Build Alpha.4 bottom-up. First add a shared authority-envelope grammar/algebra and Blueprint-v3 carrier without changing existing runtime behavior; then add the pure authority evaluator, generalize the durable Control plane, and independently wire concrete-operation and durable-mutation approval flows. Add warning/intervention Remote/UI only after both execution paths are authoritative. Perform the intentionally breaking Blueprint-v3-only cutover last, after all v3 runtime paths are usable.

**Tech Stack:** TypeScript 6, Node.js 22.19+/24+, pnpm 11.7, Vitest 4, React 18, DSH 0.2.0-rc.2, existing TeamDomain append-only stores/ledger, existing public filesystem canonicalization/containment seams.

**Spec:** `docs/plans/drafts/alpha4-permission-governance/alpha4-permission-governance-spec.md`  
**ADR:** `docs/plans/drafts/alpha4-permission-governance/ADR-alpha4-hard-governance.md`

## Global Constraints

- Implementation base is `master@2b86ee423ac23e51b87216d399c5ca93a137c12d` or a later reviewed descendant; PR #62 is already merged.
- CORE PATCH BUDGET remains 0: do not patch the DSH reference checkout or private upstream APIs.
- Final Alpha.4 Blueprint contract is schema v3 only; v1/v2 compatibility during PR1-PR6 is a temporary implementation bridge and MUST be deleted in PR7.
- Final runtime authority order is `member < leader < human-user < human-admin`.
- Existing authenticated `human`/operator normalizes to `human-user`; Alpha.4 MUST NOT expose any production constructor for `human-admin`.
- `permissionMutationEnvelope` is the Leader expansion ceiling; `teamHardEnvelope` is the Human User expansion ceiling.
- Both envelopes use `{ operationClass, matcher, maximumEffect }`, fail closed on no match, and resolve overlapping matches by the most restrictive ceiling under `deny < ask < allow`.
- Envelope intersection is logical and live; never enumerate descendants into a frozen allow-list.
- Matcher root identity is frozen for proposals; subtree membership is recomputed live.
- `deny` is terminal for a concrete invocation; only `ask` enters approval.
- Approval forbids self/same-level approval and routes upward through immutable review legs.
- A reviewer with sufficient authority has `allow | escalate | deny`; an insufficient reviewer has `deny | escalate`; Human Admin has `allow | deny`.
- `leader-approval` / `user-approval` remain compatibility vocabulary through Alpha.4 and MUST be explicitly listed for post-Alpha.4 cleanup.
- Intervention is a projection/router, never an authorization store.
- External runtime capability/environment facts are orthogonal to Team permission authority.
- Single-operation approvals are single-shot; no retry/reusable allow token in Alpha.4.
- Durable mutation approval is exact-proposal inline approval; any post-approval drift yields stale/zero-write.
- No partial permission mutation commit and no automatic matcher clipping.
- Use TDD: failing test -> confirm RED -> minimal implementation -> targeted GREEN -> broader regression -> commit.
- Production authority must remain server-derived. Remote payloads never supply trusted reviewer/admin authority.

## Baseline Verification Discipline

PR #62 merged with known pre-existing root-suite debt. Do not use “full suite green” as an Alpha.4 merge condition until the baseline debt is independently removed.

Before PR1 implementation:

- [ ] Record `git rev-parse HEAD`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` results under `dev/agent-workflow/evidence/alpha4/baseline/`.
- [ ] Save the failing test/collection names and first error lines from the exact Alpha.4 base.
- [ ] For every PR merge gate, require:
  - all new/changed targeted tests green;
  - `pnpm typecheck` green;
  - changed-file ESLint green;
  - full `pnpm lint` introduces no new diagnostic identities relative to the recorded baseline;
  - full `pnpm test` introduces no new failing test/collection identities relative to the recorded baseline.
- [ ] After any client/composition change, also run `pnpm build:composition`, `pnpm check:artifacts`, and the composition smoke relevant to the changed surface.

## Review Focus

1. **Filesystem identity drift:** symlink/junction retarget must stale a proposal, while creation/deletion of descendants under an unchanged root must not.
2. **Overlapping authority rules:** broad allow + narrow deny must deny the narrow region, and broad deny + narrow allow must remain deny.
3. **Approval drift:** a recorded allow that is no longer sufficient at last-mile must not execute and must not grow a new leg after terminal allow.
4. **Compatibility carriers:** legacy `leader-approval` / `user-approval` rows and v1/v2 execution paths must stay byte/behavior compatible until PR7.
5. **Authority vs environment:** capability unavailability must not be misreported as an approval problem, and durable mutation must be able to pre-authorize currently unavailable capability.

---

# PR / Merge Roadmap

| PR | Name | Decisive product change | Runtime compatibility after merge | Parallel lanes |
| --- | --- | --- | --- | --- |
| A4-PR1 | Authority Envelope Foundation | Shared effective-ceiling algebra + additive Blueprint v3 carrier | v1/v2 unchanged; v3 parseable but not enforced | schema / algebra / runtime binding |
| A4-PR2 | Authority Evaluation | `RuntimeAuthority` + `AuthorityCeilingEvaluator`; v3 direct mutation enforcement | v1/v2 unchanged; v3 direct decisions enforce both ceilings | evaluator / rise-refactor / production wiring |
| A4-PR3 | Approval Case Control Plane | Durable multi-leg approval cases, escalate, case outcomes, intervention core | old approval flows still work through compatibility adapters | control / case projection / restart tests |
| A4-PR4 | Operation Approval Routing | v3 `ask` routed by minimum authority; single-shot execution/capability semantics | v1/v2 continue old A2 ask routing | pre-execute / capability seam / control integration |
| A4-PR5 | Durable Mutation Proposals | v3 out-of-authority mutations become exact inline approval proposals | v1/v2 keep Alpha.3 mutation behavior | governance / approval bridge / lifecycle-CAS tests |
| A4-PR6 | Governance UX Surface | Governance warnings + Intervention Remote v8 + Permission Administration UI | old Remote/UI entry points retained | warning backend / Remote v8 / client+UI |
| A4-PR7 | v3-Only Cutover & Acceptance | Reject v1/v2 everywhere, cold-resume migration gate, remove transitional paths | final Alpha.4 behavior | fixture migration by package / cold-resume gate / acceptance |

**Required merge order:**  
`A4-PR1 -> A4-PR2 -> A4-PR3 -> A4-PR4 -> A4-PR5 -> A4-PR6 -> A4-PR7`.

**Development concurrency:** after A4-PR3's interfaces are frozen, A4-PR4 and A4-PR5 MAY be developed concurrently in separate worktrees by different agent teams. Merge A4-PR4 first, then rebase A4-PR5 onto it and rerun its full gate. A4-PR6 starts only after both are merged.

---

## Multi-Subagent Execution Protocol

For every PR:

1. Create one PR integration worktree/branch from the latest merged predecessor.
2. The coordinator writes/locks the PR-local interfaces before parallel implementation.
3. Dispatch one code-writing subagent per **file-disjoint** lane. Agents must not edit the same production file concurrently.
4. Each lane uses its own worktree and returns:
   - commits;
   - exact files changed;
   - targeted test receipts;
   - unresolved risks.
5. Integration agent cherry-picks/merges lane commits in the order stated below.
6. A fresh reviewer subagent reviews the integrated PR against ADR + Spec + this plan.
7. Fix review findings in narrowly scoped follow-up commits.
8. Run the PR merge gate and record evidence before opening/marking the PR ready.

Do not use “everyone edits the same service file and resolve conflicts later” as a parallelization strategy.

---

### Task 1 / A4-PR1: Shared Authority Envelope Foundation + Additive Blueprint v3

**Branch:** `task/alpha4-pr1-authority-envelope-foundation`

**Purpose:** Establish the reusable data model and effective-ceiling algebra while leaving all current v1/v2 runtime behavior untouched.

**Files:**
- Create: `packages/runtime/governance/authority-envelope.ts`
- Modify: `packages/runtime/governance/permission-mutation.ts`
- Modify: `packages/runtime/governance/index.ts`
- Modify: `packages/domain/blueprint/src/types.ts`
- Modify: `packages/domain/blueprint/src/schema.ts`
- Modify: `packages/domain/blueprint/src/validate.ts`
- Modify: `packages/domain/blueprint/src/index.ts`
- Modify: `packages/runtime/src/plugin/permission-plane.ts`
- Test create: `packages/runtime/test/a4p1-authority-envelope.test.ts`
- Test create: `packages/domain/test/a4p1-blueprint-v3-governance.test.ts`
- Test update: `packages/runtime/test/a3p3-permission-mutation-authority.test.ts`
- Test update: `packages/runtime/test/a3p4-r4-authority-binding.test.ts`

**Interfaces:**
- Produces:
  - `AuthorityEnvelope`
  - `AuthorityEnvelopeRule`
  - `EffectiveCeiling`
  - `parseAuthorityEnvelope(raw)`
  - `effectiveAuthorityCeiling(envelope, operationClass, matcher, subtreeContains?)`
  - Blueprint v3 `teamHardEnvelope` field
  - shared runtime builder/canonicalizer for both Blueprint envelope fields
- Compatibility:
  - keep `PermissionMutationEnvelope` / `PermissionEnvelopeRule` as aliases or thin compatibility exports during PR1-PR6;
  - do not rename callers en masse in this PR.

**Parallel lane A — Blueprint v3 carrier**
- [ ] Write RED tests in `a4p1-blueprint-v3-governance.test.ts`:
  - v3 requires `teamHardEnvelope`;
  - `rules: []` is accepted;
  - file matchers accept exact/subtree;
  - exec accepts fingerprint only;
  - malformed/unknown fields fail closed;
  - v1/v2 still parse during the temporary implementation bridge.
- [ ] Run the new domain test and confirm RED.
- [ ] Add v3 closed field sets/types/validation without changing v1/v2 field sets.
- [ ] Run domain blueprint tests GREEN.
- [ ] Commit lane A.

**Parallel lane B — effective-ceiling kernel**
- [ ] Write RED tests covering:
  - no match -> `no-authority`;
  - broad allow + narrow ask -> ask;
  - broad allow + narrow deny -> deny;
  - broad deny + narrow allow -> deny;
  - exact/fingerprint identity behavior;
  - subtree without containment seam -> undetermined where relation is required;
  - adding a matching rule never raises a ceiling.
- [ ] Confirm RED.
- [ ] Implement `authority-envelope.ts` as pure code with no storage/fs imports.
- [ ] Refactor current permission-envelope parser/matcher helpers to delegate to the shared module instead of duplicating grammar.
- [ ] Run new tests and all A3 permission-mutation tests.
- [ ] Commit lane B.

**Parallel lane C — runtime Blueprint binding**
- [ ] Add RED tests proving both envelope documents canonicalize against the target member workspace using the same fs identity/containment conventions.
- [ ] Add v3 `teamHardEnvelope` reader/builder to `permission-plane.ts`.
- [ ] Keep the reader unused by production authorization in PR1.
- [ ] Run binding tests GREEN.
- [ ] Commit lane C.

**Integration / merge gate**
- [ ] Merge lane A and B first; resolve shared type names once.
- [ ] Merge lane C against the frozen shared types.
- [ ] Run:
  - `pnpm vitest run packages/domain/test/a4p1-blueprint-v3-governance.test.ts packages/runtime/test/a4p1-authority-envelope.test.ts packages/runtime/test/a3p3-permission-mutation-authority.test.ts packages/runtime/test/a3p4-r4-authority-binding.test.ts`
  - `pnpm typecheck`
  - changed-file ESLint
  - baseline-diff `pnpm test`
- [ ] Confirm no production behavior change for v1/v2 fixtures.
- [ ] Commit integration/docs note.
- [ ] Open A4-PR1.

---

### Task 2 / A4-PR2: Runtime Authority Model + Dual-Envelope Evaluation

**Branch:** `task/alpha4-pr2-authority-evaluation`

**Purpose:** Introduce the pure minimum-authority evaluator and make v3 direct permission mutation obey both authority ceilings. Out-of-authority mutation still refuses in this PR; proposal escalation arrives in PR5.

**Files:**
- Create: `packages/runtime/governance/runtime-authority.ts`
- Create: `packages/runtime/governance/authority-ceiling.ts`
- Modify: `packages/runtime/governance/permission-mutation.ts`
- Modify: `packages/runtime/governance/service.ts`
- Modify: `packages/runtime/governance/types.ts`
- Modify: `packages/runtime/src/plugin/permission-plane.ts`
- Modify: `packages/runtime/src/plugin/root.ts`
- Test create: `packages/runtime/test/a4p2-authority-ceiling.test.ts`
- Test create: `packages/runtime/test/a4p2-dual-envelope-mutation.test.ts`
- Test update: `packages/runtime/test/a3p3-revoke-reveal-semantics.test.ts`
- Test update: `packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts`

**Interfaces:**
- Produces:
  - `RuntimeAuthority = member | leader | human-user | human-admin`
  - `authorityRank()`
  - `isHigherAuthority()`
  - `evaluateAuthorityCeiling(input): AuthorityEvaluation`
  - reusable `PermissionRiseRegion` output from Alpha.3 before/after classification
- The evaluator returns minimum authority and evidence only; it knows nothing about resolver availability.

**Parallel lane A — authority evaluator**
- [ ] Write RED matrix for Member, Leader, Human User beneficiaries.
- [ ] Pin self-approval rule: minimum approver must be strictly higher than beneficiary.
- [ ] Pin Leader ceiling = min(Leader envelope, Team Hard envelope).
- [ ] Pin Human User ceiling = Team Hard envelope.
- [ ] Implement pure evaluator and run GREEN.
- [ ] Commit.

**Parallel lane B — rise-classification refactor**
- [ ] Add RED regression proving Alpha.3 revoke/reveal behavior stays identical after extracting rise regions.
- [ ] Refactor `authorizeLeaderPermissionMutation` so closed-region partition/effective-before-after logic can produce rise facts independently of actor-specific final authorization.
- [ ] Do not weaken unknown-context handling or all-or-nothing semantics.
- [ ] Run all A3 mutation tests GREEN.
- [ ] Commit.

**Parallel lane C — production v3 dual-envelope wiring**
- [ ] Add RED integration tests:
  - Leader v3 mutation inside both ceilings commits;
  - outside Leader envelope but inside Team Hard refuses for now;
  - Human User v3 mutation inside Team Hard commits;
  - Human User outside Team Hard refuses;
  - v1/v2 behavior remains current Alpha.3 during transition.
- [ ] Extend permission lane deps with Team Hard envelope reader.
- [ ] Wire readers from `permission-plane.ts` / production root.
- [ ] Normalize existing trusted operator to `human-user` in the new permission-authority path; do not expose Admin construction.
- [ ] Run GREEN and commit.

**Integration / merge gate**
- [ ] Integrate B before C so service consumes the new rise interface.
- [ ] Run all A3 permission-governance tests plus A4P2 tests.
- [ ] Run `pnpm typecheck`, changed-file lint, full baseline-diff tests.
- [ ] Explicitly document the temporary PR2 behavior: “higher authority required” is still a refusal until PR5.
- [ ] Open A4-PR2.

---

### Task 3 / A4-PR3: Durable Approval Cases, Escalation, and Intervention Core

**Branch:** `task/alpha4-pr3-approval-cases`

**Purpose:** Generalize the existing durable Control plane into linked approval cases without changing existing callers' default allow/deny flows.

**Files:**
- Modify: `packages/runtime/control/types.ts`
- Modify: `packages/runtime/control/service.ts`
- Modify: `packages/runtime/control/index.ts`
- Modify: `packages/runtime/control/leader-notification.ts`
- Create: `packages/runtime/intervention/types.ts`
- Create: `packages/runtime/intervention/projection.ts`
- Create: `packages/runtime/intervention/index.ts`
- Modify: `packages/contracts/src/projection/ledger.ts` only if an additive count/read field is actually required; do not broaden ledger categories merely for cleanliness.
- Test create: `packages/runtime/test/a4p3-approval-case.test.ts`
- Test create: `packages/runtime/test/a4p3-approval-escalation.test.ts`
- Test create: `packages/runtime/test/a4p3-intervention-projection.test.ts`
- Test update: `packages/runtime/test/control-legacy-row-compat.test.ts`
- Test update: `packages/runtime/test/p6t4-restart.test.ts`
- Test update: `packages/runtime/test/f9-control-exactly-once.test.ts`

**Interfaces:**
- Additive review-leg fields:
  - `approvalCaseId`
  - `reviewAuthority`
  - `requiredAuthorityAtCreation`
  - `previousRequestId?`
- Decision adds `escalate`.
- New service operations should include exact equivalents of:
  - create/request approval leg;
  - resolve current leg with `allow | deny | escalate`;
  - derive case state/history;
  - append terminal execution/mutation outcome;
  - list/project interventions.
- Existing `requestControl`, `awaitControlDecision`, `guardOperation`, legacy rows, and legacy request kinds remain supported.

**Parallel lane A — durable control/case model**
- [ ] Write RED tests for linked immutable legs and same `approvalCaseId`.
- [ ] Add additive fields with legacy-row normalization defaults.
- [ ] Add `escalate` decision value.
- [ ] Ensure escalation closes current leg and can never authorize guard execution.
- [ ] Ensure terminal allow/deny/stale legs cannot be resolved again.
- [ ] Commit.

**Parallel lane B — legal-action derivation + case outcomes**
- [ ] Write RED tests:
  - insufficient reviewer -> deny/escalate;
  - sufficient non-admin -> allow/escalate/deny;
  - Human Admin -> allow/deny;
  - escalated reviewer cannot later allow;
  - `requiredAuthorityAtCreation` is provenance only.
- [ ] Implement server-side derivation interface that accepts a fresh required-authority reader.
- [ ] Add terminal case outcome vocabulary needed by PR4/PR5:
  - operation: execution-succeeded / execution-unavailable / stale / denied / authority-unavailable;
  - mutation: mutation-committed / mutation-no-change / mutation-stale / denied / authority-unavailable.
- [ ] Commit.

**Parallel lane C — Intervention core projection**
- [ ] Write RED projection tests for `kind`, `responseBehavior`, `blockScope`, current/required authority, legal actions, and terminal statuses.
- [ ] Implement projection from Control state only in this PR; leave source adapter interfaces open for Compatibility/GovernanceWarning in PR6.
- [ ] Prove projection mutation cannot authorize a Control operation.
- [ ] Commit.

**Integration / merge gate**
- [ ] Existing `leader-approval` / `user-approval` tests must remain green.
- [ ] Legacy rows without Alpha.4 fields must reconstruct exactly enough for current v1/v2 behavior.
- [ ] Restart test must reconstruct active leg and case chain.
- [ ] Full gate; open A4-PR3.

---

### Task 4 / A4-PR4: Concrete Operation Approval Routing and Single-Shot Execution

**Branch:** `task/alpha4-pr4-operation-approval`

**Purpose:** Replace v3 caller-role-to-request-kind routing with minimum-authority routing and enforce single-shot operation approval with capability/environment preflight + last-mile checks.

**Files:**
- Create: `packages/runtime/operation-permission/approval-routing.ts`
- Modify: `packages/runtime/operation-permission/pre-execute-adapter.ts`
- Modify: `packages/runtime/operation-permission/index.ts`
- Modify: `packages/runtime/src/plugin/live/agent-bindings.mjs`
- Modify: `packages/runtime/src/plugin/root.ts`
- Modify: `packages/runtime/control/service.ts` only through interfaces frozen in PR3; if new generic case method is needed, coordinator lands the interface commit before parallel lanes.
- Test create: `packages/runtime/test/a4p4-operation-approval-authority.test.ts`
- Test create: `packages/runtime/test/a4p4-operation-single-shot.test.ts`
- Test create: `packages/runtime/test/a4p4-capability-vs-permission.test.ts`
- Test update: `packages/runtime/test/a5a-pre-execute.test.ts`
- Test update: `packages/runtime/test/p6t4-allow-once.test.ts`
- Test update: `packages/runtime/test/a2c4-external-lastmile.test.ts`
- Test update: `packages/runtime/test/control-guard-leader.test.ts`

**Interfaces:**
- v3 operation routing consumes:
  - beneficiary RuntimeAuthority;
  - current concrete canonical operation;
  - both authority envelopes;
  - fresh containment;
  - fresh Control case service.
- Existing v1/v2 `isLeader ? user-approval : leader-approval` path remains temporary until PR7.
- Capability/environment check should return a typed internal outcome distinct from Team permission denial even if the upstream DSH pre-tool carrier ultimately represents both as a non-execution result.

**Parallel lane A — approval routing**
- [ ] RED tests for Member -> Leader / Human User / Human Admin minimum authority.
- [ ] RED tests for Leader own ask -> Human User/Admin.
- [ ] Wire `ask` to PR3 approval cases and server-derived legal actions.
- [ ] Preserve legacy request kind as compatibility carrier, not semantic authority.
- [ ] Commit.

**Parallel lane B — runtime capability separation**
- [ ] RED test: unavailable at preflight -> no ControlRequest written.
- [ ] RED test: permission allow + unavailable -> capability/environment outcome, not approval escalation.
- [ ] Refactor existing external runtime check into an explicit preflight seam and retain last-mile recheck.
- [ ] Do not add this check to durable permission mutation.
- [ ] Commit.

**Parallel lane C — single-shot terminal semantics**
- [ ] RED tests:
  - reviewer allow + authority drift -> stale/no execution;
  - reviewer allow + capability disappears -> execution-unavailable;
  - failed invocation cannot reuse prior allow;
  - successful exact invocation consumes exactly once.
- [ ] Record case terminal outcome without rewriting the durable review decision.
- [ ] Commit.

**Integration / merge gate**
- [ ] Run existing A2 control/pre-execute suites and new A4P4 suites.
- [ ] Ensure no v1/v2 operation behavior changes before PR7.
- [ ] Run full gate and open A4-PR4.

---

### Task 5 / A4-PR5: Durable Permission Mutation Proposals and Inline Approval

**Branch:** `task/alpha4-pr5-mutation-proposals`

**Purpose:** Turn v3 permission mutations that require higher authority into exact immutable proposals, review them through the PR3 approval chain, and revalidate/commit inline.

**Files:**
- Create: `packages/runtime/governance/permission-approval.ts`
- Modify: `packages/runtime/governance/service.ts`
- Modify: `packages/runtime/governance/types.ts`
- Modify: `packages/runtime/governance/permission-mutation.ts`
- Modify: `packages/runtime/permission-governance/types.ts` only if result/provenance vocabulary needs additive export.
- Modify: `packages/runtime/src/plugin/root.ts`
- Modify: `packages/tools/src/tools.ts` only to consume the new result shape; do not fork a second mutation authority.
- Modify: `packages/tools/src/types.ts`
- Test create: `packages/runtime/test/a4p5-permission-mutation-proposal.test.ts`
- Test create: `packages/runtime/test/a4p5-permission-mutation-inline-commit.test.ts`
- Test create: `packages/runtime/test/a4p5-self-mutation.test.ts`
- Test update: `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts`
- Test update: `packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts`
- Test update: `packages/runtime/test/a3p3-revoke-reveal-semantics.test.ts`

**Interfaces:**
- Introduce a narrow `PermissionMutationApprovalPort` used by GovernanceMutationService.
- Avoid a construction cycle by using an injected late-bound ref/adapter, following existing `controlServiceRef` patterns; Governance must not import the production ControlService implementation.
- Proposal fingerprint binds exact mutation identity, canonical matcher roots/fingerprints, target, requested effects, expected generation, beneficiary, Blueprint contentHash/authority generation, and provenance reason; it does not bind subtree descendants.

**Parallel lane A — proposal planning**
- [ ] RED tests for Leader mutation beyond Leader ceiling but inside Team Hard -> approval proposal.
- [ ] RED test for Human User beyond Team Hard -> Human Admin required.
- [ ] RED test Member initiation rejected before proposal creation.
- [ ] Implement exact proposal representation/fingerprint and approval port contract.
- [ ] Commit.

**Parallel lane B — inline revalidation/commit**
- [ ] RED tests for:
  - approved proposal commits one snapshot;
  - CAS drift -> mutation-stale/zero-write;
  - lifecycle drift -> mutation-stale;
  - matcher root identity drift -> mutation-stale;
  - descendant-set change under same root does not stale;
  - current desired state already reached -> mutation-no-change.
- [ ] Re-run rise classification + authority evaluation at commit boundary.
- [ ] Keep append-only snapshot commit as the only source of durable permission authority.
- [ ] Commit.

**Parallel lane C — self-mutation and batch semantics**
- [ ] RED tests:
  - Leader self-tightening direct;
  - Leader self-expansion requires Human User/Admin;
  - multi-region proposal with one insufficient region is all-or-nothing;
  - revoke/reveal rise routes through approval when required.
- [ ] Implement using existing batch planner, not rule-by-rule partial writes.
- [ ] Commit.

**Integration / merge gate**
- [ ] Rebase onto merged A4-PR4 if developed concurrently.
- [ ] Run full A3 governance family + A4P5 tests.
- [ ] Verify no new mutation authority write path exists outside GovernanceMutationService.
- [ ] Full gate; open A4-PR5.

---

### Task 6 / A4-PR6: Governance Warnings, Intervention Remote v8, and Permission Administration UI

**Branch:** `task/alpha4-pr6-intervention-ui`

**Purpose:** Make Alpha.4 observable and operable without redesigning the whole existing UI/Remote stack.

**Files — warning/intervention backend:**
- Create: `packages/runtime/governance-warning/types.ts`
- Create: `packages/runtime/governance-warning/service.ts`
- Create: `packages/runtime/governance-warning/index.ts`
- Modify: `packages/runtime/intervention/projection.ts`
- Modify: `packages/runtime/intervention/types.ts`
- Modify: `packages/runtime/src/plugin/root.ts`
- Modify: `packages/runtime/src/plugin/projection-source.ts` only where needed for summary linkage.
- Prefer append-only ledger facts in the existing `policy` category for warning observed/acknowledged history rather than adding a new top-level ledger category.

**Files — Remote v8:**
- Modify: `packages/remote/src/contracts/version.ts`
- Modify: `packages/remote/src/contracts/catalog.ts`
- Modify: `packages/remote/src/contracts/params.ts`
- Modify: `packages/remote/src/contracts/types.ts`
- Modify: `packages/remote/src/contracts/index.ts` / package barrel as needed
- Modify: `packages/remote/src/handlers/ports.ts`
- Modify: relevant remote category handler/dispatcher files
- Modify: `packages/runtime/src/plugin/s6-remote.ts`

**Files — client/UI:**
- Modify: `packages/client/src/transport/team-remote-client.ts`
- Create: `packages/client/src/model/team-interventions.ts`
- Create: `packages/client/src/ui/TeamInterventions.tsx`
- Create: `packages/client/src/ui/TeamInterventions.module.css`
- Modify: `packages/client/src/model/team-governance.ts`
- Modify: `packages/client/src/ui/TeamGovernance.tsx`
- Add Permission Administration read/model helpers; prefer a new read endpoint such as `override.getPermissionAdministration` rather than changing v7 `override.getPermission` semantics.

**Tests:**
- Create: `packages/runtime/test/a4p6-governance-warning.test.ts`
- Create: `packages/runtime/test/a4p6-intervention-aggregation.test.ts`
- Create: `packages/remote/test/a4p6-remote-v8.test.ts`
- Create: `packages/client/test/a4p6-interventions.client.spec.tsx`
- Create: `packages/client/test/a4p6-permission-administration.client.spec.tsx`
- Update: `packages/client/test/team-governance.client.spec.tsx`
- Update: `packages/client/test/team-remote-client.test.ts`

**Coordinator interface-freeze commit before parallel lanes**
- [ ] Define `InterventionItem`, `InterventionAction`, source adapters, and v8 wire DTOs.
- [ ] Define the v8 methods:
  - `intervention.list`
  - `intervention.get`
  - `intervention.act`
  - `override.getPermissionAdministration`
- [ ] Freeze client payload rule: only `teamSessionId, interventionId, action, note?`; never client-supplied authority/legalActions.

**Parallel lane A — GovernanceWarning authority**
- [ ] RED tests for `consistent | mismatch | undetermined`.
- [ ] Implement configuration/runtime fingerprints and observed-count dedup.
- [ ] Implement fingerprint-bound acknowledgement.
- [ ] Prove acknowledgement does not affect authority evaluator output.
- [ ] Add runtime boundary observation hooks.
- [ ] For Blueprint authoring, provide the pure create/publish diagnostic API; because Alpha.4 has no Blueprint editor, do not invent a new editor solely for this warning.
- [ ] At Team start, place a governance gate between durable Team binding and Leader activation: warning-required may leave a durable Team root not yet live, then acknowledgement + existing ensure/open path continues startup.
- [ ] Commit.

**Parallel lane B — Intervention aggregation + Remote v8**
- [ ] Aggregate Control approval, Compatibility warning, GovernanceWarning, and capability/environment terminal observations into one read projection.
- [ ] Implement `intervention.act` strictly as a fresh router to authoritative services.
- [ ] Add Remote v8 version/catalog/params/ports/runtime handler.
- [ ] Preserve v1-v7 method behavior.
- [ ] Add `override.getPermissionAdministration` read projection.
- [ ] Commit.

**Parallel lane C — client transport/model**
- [ ] Add v8 wrappers in `team-remote-client.ts`.
- [ ] Parse Intervention and Permission Administration values without inventing authority locally.
- [ ] Add client tests that reject malformed legalActions/authority fields from wire.
- [ ] Commit.

**Parallel lane D — UI**
- [ ] Add Intervention list showing kind/status/source/response behavior/block scope/current+required authority/legal actions.
- [ ] Add Permission Administration view showing Blueprint identity, static policy, both envelopes, overlay generation/provenance, effective summary, and diagnostics.
- [ ] Do not expand subtree rules into a frozen filesystem tree.
- [ ] Once a leg escalates, old leg is visibly terminal and no action remains.
- [ ] Keep existing TeamGovernance functionality; do not broadly refactor unrelated UI.
- [ ] Commit.

**Integration / merge gate**
- [ ] Merge A then B, then C/D after v8 contract is stable.
- [ ] Run Remote version regression 1-8.
- [ ] Run client tests, `pnpm build:composition`, `pnpm check:artifacts`, and composition smoke.
- [ ] Run full baseline-diff gate.
- [ ] Open A4-PR6.

---

### Task 7 / A4-PR7: Blueprint-v3-Only Cutover, Cold-Resume Gate, and Full Alpha.4 Acceptance

**Branch:** `task/alpha4-pr7-v3-cutover-acceptance`

**Purpose:** Perform the intentionally breaking migration only after all v3 runtime, Remote, and UI surfaces are complete.

**Files:**
- Modify: `packages/domain/blueprint/src/schema.ts`
- Modify: `packages/domain/blueprint/src/validate.ts`
- Modify: Blueprint version tests under `packages/domain/test/`
- Modify: `packages/runtime/src/plugin/bound-blueprint.ts`
- Modify: root/cold-resume/activation files that currently accept v1/v2
- Modify: all repository test fixtures/Blueprint strings that represent supported runnable Teams
- Update: ADR/Spec status and final Alpha.4 docs
- Add evidence: `dev/agent-workflow/evidence/alpha4-final/`

**Interfaces:**
- Final `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]`.
- Add/standardize typed outcomes equivalent to:
  - `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED`
  - `BLUEPRINT_MIGRATION_REQUIRED`
- Remove all PR1-PR6 transitional v1/v2 authorization branches.

**Parallel lane A — domain cutover**
- [ ] Write RED test that v1/v2 are rejected under final Alpha.4.
- [ ] Set supported schema to v3 only.
- [ ] Remove transitional legacy-unbounded/legacy-routing assumptions from domain/runtime types.
- [ ] Run domain tests.
- [ ] Commit.

**Parallel lane B — cold-resume/runtime gate**
- [ ] RED test: persisted Team bound to v1/v2 fails before Leader/Member activation.
- [ ] Implement migration-required gate in bound Blueprint/cold-resume path.
- [ ] Prove no implicit Team/overlay migration and zero agent startup.
- [ ] Commit.

**Parallel lanes C1..Cn — fixture migration by package**
Dispatch independent agents by package to avoid shared files:
- C1: `packages/domain/test` Blueprint fixtures;
- C2: `packages/runtime/test` fixtures;
- C3: `packages/tools/test` and harness fixtures;
- C4: `packages/remote/test` fixtures;
- C5: `packages/client/test` fixtures;
- C6: `packages/testkit/test` / maintained kit fixtures.

Each agent:
- [ ] Migrates only supported/live Blueprint fixtures to v3 with explicit `teamHardEnvelope`.
- [ ] Chooses Team Hard rules that preserve the fixture's intended pre-Alpha.4 permissions rather than blindly using an unbounded approximation.
- [ ] Leaves historical evidence files untouched.
- [ ] Runs package-local tests and commits.

**Parallel lane D — final acceptance/security matrix**
- [ ] Add/assemble a single Alpha.4 acceptance suite that pins:
  - v3-only migration;
  - no-match zero authority;
  - monotonic overlapping ceilings;
  - live descendant creation;
  - root identity drift;
  - Member/Leader/Human authority routing;
  - sufficient-reviewer voluntary escalation;
  - Human Admin terminal routing/unavailability;
  - Member mutation rejection;
  - Leader self-tighten/self-expand;
  - revoke/reveal;
  - batch atomicity;
  - single-shot capability preflight/last-mile semantics;
  - mutation CAS/lifecycle/identity drift;
  - warning dedup/ack;
  - restart reconstruction;
  - cross-instance/cross-Team isolation;
  - Intervention non-authority.
- [ ] Record all receipts under `dev/agent-workflow/evidence/alpha4-final/`.
- [ ] Commit.

**Integration / final gate**
- [ ] Merge A+B first, then fixture lanes, then acceptance lane.
- [ ] Run targeted Alpha.4 acceptance suite.
- [ ] Run `pnpm typecheck`.
- [ ] Run changed-file ESLint.
- [ ] Run full `pnpm lint` and compare diagnostic identities to baseline.
- [ ] Run full `pnpm test` and compare failing test/collection identities to baseline; Alpha.4 may remove baseline failures but must add none.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm build:composition`.
- [ ] Run `pnpm check:artifacts`.
- [ ] Run `pnpm smoke:composition`.
- [ ] Run the maintained real-host/Chrome acceptance lanes that are applicable to Team Governance UI, under the existing sandbox/port/ownership discipline; do not claim live acceptance for any lane not actually executed.
- [ ] Update ADR/Spec from Draft to Accepted only after review and evidence.
- [ ] Open A4-PR7.

---

# PR Review / Merge Rules

Every PR must include:

- a short architecture delta note;
- exact RED/GREEN receipts for new behavior;
- statement of temporary semantics that remain until a later Alpha.4 PR;
- baseline-diff result for the root suite;
- explicit confirmation that no new production authority path bypasses the canonical service.

Review order per PR:

1. implementation-lane self-check;
2. integration coordinator review;
3. independent code-review subagent;
4. targeted security reviewer for PR2, PR3, PR4, PR5, PR7;
5. merge only after all blocking findings are resolved.

Do not merge PR N+1 before PR N's reviewed interfaces are on `master`, except that A4-PR4 and A4-PR5 may be developed concurrently from the A4-PR3 interface freeze as described above.

# Expected Stable Plugin State After Each Merge

**After A4-PR1:** current plugin behavior unchanged; v3 documents can be parsed/tested and the new envelope algebra exists.

**After A4-PR2:** v3 direct mutation paths enforce the new ceilings; current v1/v2 users remain operational.

**After A4-PR3:** durable approval-case/escalation substrate exists while current approval flows remain compatible.

**After A4-PR4:** v3 concrete operations use the final Alpha.4 approval authority model; old Blueprints still use legacy routing.

**After A4-PR5:** v3 durable mutations use exact proposal approval and inline revalidation; v1/v2 retain old behavior.

**After A4-PR6:** Alpha.4 is fully observable/operable through Remote/UI for v3 Teams; old UI/Remote commands remain compatible.

**After A4-PR7:** final Alpha.4: v3-only, old Teams require explicit migration/new Team creation, all transitional branches removed.

# Post-Alpha.4 Backlog Created by This Plan

Record but do not implement in these PRs:

- real Human Admin authentication/resolver;
- Blueprint ACL / configuration-admin authority;
- runtime Blueprint hot-rebind with authority-generation invalidation;
- asynchronous approval continuation;
- reusable operation approval/retry tokens;
- per-template/per-member Team Hard envelopes;
- automatic matcher subtraction/clipping;
- partial mutation commits;
- cleanup/removal of `leader-approval` / `user-approval`;
- consolidation of `team.resolveControl` with `intervention.act`;
- broader Control/Compatibility/GovernanceWarning API/UI cleanup;
- durable Control schema compaction/migration solely for cleanliness.

# Self-Review Checklist

- [ ] Every ADR/Spec requirement maps to one PR/task above.
- [ ] No PR requires Alpha.4-final v3-only behavior before all v3 runtime paths exist.
- [ ] No parallel code-writing lane owns the same production file.
- [ ] The two highest-risk shared files (`governance/service.ts`, `control/service.ts`) have one writer per PR and frozen interfaces before consumers run in parallel.
- [ ] Effective-ceiling semantics replace existential envelope coverage everywhere by PR7.
- [ ] Both operation and mutation approval use the same RuntimeAuthority model.
- [ ] Capability/environment failure never enters approval routing.
- [ ] Intervention remains projection/router only.
- [ ] Legacy control vocabulary is explicitly retained and explicitly placed on the post-Alpha.4 cleanup list.
- [ ] Final cutover removes transitional v1/v2 branches rather than leaving hidden legacy semantics.
