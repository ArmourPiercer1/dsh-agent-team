# Alpha.4 Permission Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For the intended execution model, also use `superpowers:dispatching-parallel-agents` whenever a PR contains file-disjoint work lanes.

**Goal:** Implement the Alpha.4 runtime authority hierarchy, effective-ceiling envelopes, multi-leg approval routing, durable mutation proposals, intervention/warning surfaces, and final Blueprint-v3-only migration without making intermediate PRs unnecessarily unusable.

**Architecture:** Build Alpha.4 bottom-up. First add a shared authority-envelope grammar/algebra and Blueprint-v3 carrier without changing existing runtime behavior; then add the pure authority evaluator, generalize the durable Control plane, and independently wire concrete-operation and durable-mutation approval flows. Add warning/intervention Remote/UI only after both execution paths are authoritative. Perform the intentionally breaking Blueprint-v3-only cutover last, after all v3 runtime paths are usable.

**Tech Stack:** TypeScript 6, Node.js 22.19+/24+, pnpm 11.7, Vitest 4, React 18, DSH 0.2.0-rc.2, existing TeamDomain append-only stores/ledger, existing public filesystem canonicalization/containment seams.

**Spec:** `docs/plans/active/alpha4-permission-governance/alpha4-permission-governance-spec.md`  
**ADR:** `docs/plans/active/alpha4-permission-governance/ADR-alpha4-hard-governance.md`  
**Amendment precedence:** A5 > A4 > A3 > A2 > A1 > the amendment-free task bodies above (ADR "Global Precedence"); a semantic change is only done once it is also reflected in the task body an implementer executes from.

## Global Constraints

- Implementation base is `master@2b86ee423ac23e51b87216d399c5ca93a137c12d` or a later reviewed descendant; PR #62 is already merged.
- CORE PATCH BUDGET remains 0: do not patch the DSH reference checkout or private upstream APIs.
- Final Alpha.4 Blueprint contract is schema v3 only; v1/v2 compatibility during PR1-PR6 is a temporary implementation bridge and MUST be deleted in PR7.
- Final runtime authority order is `member < leader < human-user < human-admin`.
- Existing authenticated `human`/operator normalizes to `human-user`; Alpha.4 MUST NOT expose any production constructor for `human-admin`.
- `permissionMutationEnvelope` is the Leader expansion ceiling; `teamHardEnvelope` is the Human User expansion ceiling.
- Both envelopes use `{ operationClass, matcher, maximumEffect }` and resolve overlapping matches by the most restrictive ceiling under `deny < ask < allow` (`undetermined` absorbing). **No-match semantics are plane-specific (ADR A1-4/A3-1/A3-2):** on the expansion plane no matching rule means no authority; on the operation approval plane an absent rule imposes **no** narrowing, and both documents are always evaluated for every reviewer and beneficiary. "Fail closed on no match" is not a global rule and must not be implemented as one.
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

Before A4-PR0a (the baseline-diff is a PR0a and PR0 gate):

- [ ] Record `git rev-parse HEAD`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` results under `dev/agent-workflow/evidence/alpha4/baseline/`.
- [ ] Save the failing test/collection names and first error lines from the exact Alpha.4 base.
- [ ] For every PR merge gate, require:
  - all new/changed targeted tests green;
  - `pnpm typecheck` green;
  - changed-file ESLint green;
  - full `pnpm lint` introduces no new diagnostic identities relative to the recorded baseline;
  - full `pnpm test` introduces no new failing test/collection identities relative to the recorded baseline.
- [ ] After any client/composition change, also run `pnpm build` (dist co-commit rule), `pnpm build:composition`, `pnpm check:artifacts`, recompute the `p4t6` scannable-file inventory pin, and the composition smoke relevant to the changed surface (client-leg smoke runs at base parity per Amendment A1.2.4). This applies to every PR1-PR7 gate, not only composition-touching ones.

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
| A4-PR0a | Ledger Category Closure (defect fix) | An abandoned inline control request stops breaking `team.getProjection`; a closed-set guard test makes an unregistered fact type fail a test instead of a read plane | projection reads for Teams that abandoned a request work again | A (fix, RED-first), B (guard test) |
| A4-PR0 | Governance Proposal Substrate | Durable append-only proposal fact (`governance-proposal-recorded`), strict reader with typed `corrupt-record`, `FACT_TYPE_CATEGORY` registration, `scripts/fail-set.mjs` | none (no product behaviour change; no storage schema change) | A (store), B (projection + tests) |
| A4-PR1 | Authority Envelope Foundation | Shared effective-ceiling algebra + additive Blueprint v3 carrier | v1/v2 unchanged; v3 parseable but not enforced | schema / algebra / runtime binding |
| A4-PR2 | Authority Evaluation | `RuntimeAuthority` + `AuthorityCeilingEvaluator`; v3 direct mutation enforcement | v1/v2 unchanged; v3 direct decisions enforce both ceilings | evaluator / rise-refactor / production wiring |
| A4-PR3 | Approval Case Control Plane | Durable multi-leg approval cases, escalate, case outcomes, intervention core | old approval flows still work through compatibility adapters | control / case projection / restart tests |
| A4-PR4 | Operation Approval Routing | v3 `ask` routed by minimum authority; single-shot execution/capability semantics | v1/v2 continue old A2 ask routing | pre-execute / capability seam / control integration |
| A4-PR5 | Durable Mutation Proposals | v3 out-of-authority mutations become exact inline approval proposals | v1/v2 keep Alpha.3 mutation behavior | governance / approval bridge / lifecycle-CAS tests |
| A4-PR6 | Governance UX Surface | Governance warnings + Intervention Remote v8 + Permission Administration UI | old Remote/UI entry points retained | warning backend / Remote v8 / client+UI |
| A4-PR7 | v3-Only Cutover & Acceptance | Reject v1/v2 everywhere, cold-resume migration gate, remove transitional paths | final Alpha.4 behavior | fixture migration by package / cold-resume gate / acceptance |

**Required merge order:**  
`A4-PR0a -> A4-PR0 -> A4-PR1 -> A4-PR2 -> A4-PR3 -> A4-PR4 -> A4-PR5 -> A4-PR6 -> A4-PR7`.

(PR0 was inserted by Amendment A2/A3; it carries no product behaviour change but everything else in Alpha.4 needs a durable home for an authority-bearing record, and it holds the baseline-diff tool plus the `p4t6` pin-recompute authority.)

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
- Create: `packages/domain/authority-envelope/src/authority-envelope.ts` + `packages/domain/authority-envelope/src/index.ts` — **the grammar lives in `domain`, not `packages/runtime/governance/` (ADR A2-3; A5-12)**. A checkbox-driven implementer must not build it under `packages/runtime/`: that would create the domain-bypass edge A2-3 forbids.
- Create: runtime adapter `packages/runtime/governance/authority-ceiling.ts` (no storage/fs imports) exposing `mayReview` / `grantCeiling` / `bindingDocs` per ADR A3-2/A5-1.
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
- Modify: `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts` — **added by ADR X7-R1.** PR2's production files will import `permission-mutation.ts` (at minimum `PermissionResourceMatcher`, even type-only) and the consumer walk at `:107-157` flags that **including `import type`**, so without a reviewed skip-list entry PR2 cannot compile its own design. Storage/`permission-overlay.js` entries must NOT be added: the edge scan at `:360-373` already covers every `.ts` in `governance/` and PR2 needs no new storage edge.
- Test create: `packages/runtime/test/a4p2-ceiling-reachability.test.ts` — **added by ADR X7-R1**: spec §7.4.1 names this file and its owning PR as PR2 lane A, and X5-B1 struck the same duty from PR1; the file was simply absent from this list, which under the one-writer rule makes it unwriteable.
- Modify: `packages/testkit/test/p4t6-session-event-scan.test.ts` — **added by ADR X7-R1** (rule 8 / A5-17 continuous recompute authority; pin is **978** at `:52` and PR2 adds ≥3 scannable files) plus the recompute receipt line.
- Text/pin owner for `packages/tools/src/tools.ts` — **undecidable in the plan as written (ADR X7-R4)**, so it is NOT silently assigned: A2-18 gives description-string updates to "the PR that changes the algebra" (= PR2), while A5-11 gives `tools.ts` to PR4. No test pins those strings today (verified: zero test hits), so whichever way this is ruled, PR2 must positively pin whatever wording ships in its own dual-envelope test. Do not edit `tools.ts` without the ruling.

**Interfaces:**
- Produces:
  - `RuntimeAuthority` — **not a re-spelled union.** It is `import type { ProposalAuthorityPosition } from './proposal-store.js'` aliased to that name (ADR X2/X7-R3), because X2 froze the four-position ladder at PR0 and forbids a second divergent ladder type. A locally re-typed `'member' | 'leader' | 'human-user' | 'human-admin'` is **structurally assignable both directions with no import at all**, so the mutual-assignability test alone cannot catch it: PR2 must also carry a source-scan leg (imports `./proposal-store.js`; contains no re-spelled ladder literals) and a positive containment leg (rank-map keys ≡ `PROPOSAL_AUTHORITY_POSITIONS`). Beware `as const satisfies readonly ProposalAuthorityPosition[]` on a local array — it passes with a *subset* and silently creates a second ordering.
  - `authorityRank()`
  - `isHigherAuthority()`
  - `evaluateAuthorityCeiling(input): AuthorityEvaluation`
  - reusable `PermissionRiseRegion` output from Alpha.3 before/after classification
  - `mayReview(reviewer: RuntimeAuthority, beneficiary: RuntimeAuthority, requiredAuthority: RuntimeAuthority): boolean` — **ADR X7-R2**: flat parameters, all required, **no defaults** (a defaulted or optional `requiredAuthority` is silently permissive). PR2 must not invent an `ApprovalCase` type: PR3 owns that shape and its legs carry `reviewAuthority` / `beneficiaryAuthority` / `requiredAuthorityAtCreation`, which map onto these three parameters 1:1.
- The evaluator returns minimum authority and evidence only; it knows nothing about resolver availability.

**Parallel lane A — authority evaluator**
- [ ] Write the positional RED matrix keyed by **reviewer** position — `member < leader < human-user`, with a `human-admin` row that is bound by nothing (A5-1: binding is by reviewer position, not beneficiary shape; A5 addendum "Ceiling tests are positional"). Keep beneficiary variation as a second axis only; a per-shape matrix would re-test the retired model and leave the Admin row missing.
- [ ] Pin self-approval rule: minimum approver must be strictly higher than beneficiary.
- [ ] Pin the **expansion-plane** Leader ceiling = meet of (Leader `permissionMutationEnvelope`, `teamHardEnvelope`) via PR1's `effectiveAuthorityCeiling` — and state in the test name which plane it is. Do **not** reuse this result for approvals: the approval plane is PR1's `narrowingForApproval`, whose no-match case is the meet **identity** (ADR X5-E3); meeting expansion results there annihilates every legal approval whenever a binding document has `rules: []`. Leader is bound by **both** documents, Human User by `teamHardEnvelope` only, Human Admin by neither (A5-1).
- [ ] Pin the **expansion-plane** Human User ceiling = `teamHardEnvelope` only (never the Leader envelope, which is not a document that binds Human User — A5-1), same plane discipline as the row above: do not reuse the expansion result for `mayReview`/`grantCeiling`. Add the `human-admin` row here too: bound by neither document, so a pin that caps it is a relaxation in the forbidden direction.
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
- [ ] **Gate placement is contractual (ADR X7-R5, evidence `dev/agent-workflow/evidence/a4-pr2/PREFLIGHT-RULINGS.md`)**:
  - the dual-ceiling evaluation runs **after** the existing pre-classification context gate and rise classification, never before: a v3 ceiling check placed ahead of them relabels `EFFECT_CONTEXT_UNAVAILABLE` as a ceiling refusal, which is the deny-masquerade class (`permission-mutation.ts:1107-1185` is the code that must keep its order);
  - ceiling-**undetermined** stays a CONTEXT-typed refusal; a **decided** insufficient ceiling gets a NEW additive error code — reusing `EXPANSION_OUTSIDE_ENVELOPE` for "Human User outside Team Hard" would make PR5's proposal routing key on a knowingly mislabeled code;
  - v3 selection keys on `schemaVersion === 3` only — never on reader presence and never on `rules.length`, because v3 `{rules: []}` is a legal zero-expansion-authority document (§3.4; the A5-4 lesson);
  - pin all of the above with a blocking RED in `a4p2-dual-envelope-mutation.test.ts`: **no existing test can see this ordering** (verified: the v3 gate does not exist yet), so if PR2 does not write it, nothing will ever go red.
- [ ] Extend permission lane deps with Team Hard envelope reader.
- [ ] Wire readers from `permission-plane.ts` / production root.
- [ ] Normalize existing trusted operator to `human-user` in the new permission-authority path; do not expose Admin construction.
- [ ] Run GREEN and commit.

**Integration / merge gate**
- [ ] Integrate B before C so service consumes the new rise interface.
- [ ] Run all Alpha.3 permission-governance tests plus A4P2 tests (the Alpha.3 user-facing record lives at `dev/agent-workflow/evidence/alpha3-pr5-notification-projection/ALPHA3-PERMISSIONS-USER-FACING.md`).
- [ ] Run the plan's full PR gate set, not a shortened version of it: **rule 10** `pnpm -r run typecheck` (exit 0 / **×8** — `packages/legacy` declares no `typecheck` script) + `pnpm exec eslint <changed files>`; **rule 8** `pnpm build && pnpm build:composition && pnpm run check:artifacts` with the drift co-committed in the same commit (PR2 wires `service.ts` → `authority-ceiling.ts`/`runtime-authority.ts`, so expect `packages/runtime/dist/packages/runtime/governance/{runtime-authority,authority-ceiling,service,index}.{js,d.ts,*.map}` transitively — the runtime build include omits `governance` but transitive emission still applies, A5-19; that is rule 8, not a regression); the `p4t6` scannable-file pin recompute (current value **978**, PR2 adds ≥3 files) with its receipt; and the full baseline diff captured **twice** per A1.2.3 (`rm -rf packages/testkit/test/.tmp-fault/` first), reference = **22 identities / 9 files**, bar `NEW=0`.
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
- Reviewer action set gains `escalate` as a **leg fact** — the durable decision vocabulary stays `allow | deny | stale-denied` (`control/types.ts:169-182`); `escalate` never enters it (ADR A2-1/A3-3).
- New service operations should include exact equivalents of:
  - create/request approval leg;
  - resolve current leg with `allow | deny | stale-denied` — **the frozen vocabulary** (ADR A2-1); escalation is a separate operation that appends the `control-escalation-recorded` leg fact and a terminal `deny` decision row carrying the additive reason `escalated`, so the inline waiter resolves (ADR A5-5);
  - derive case state/history;
  - append terminal execution/mutation outcome;
  - list/project interventions.
- Existing `requestControl`, `awaitControlDecision`, `guardOperation`, legacy rows, and legacy request kinds remain supported.

**Parallel lane A — durable control/case model**
- [ ] Write RED tests for linked immutable legs and same `approvalCaseId`.
- [ ] Add additive fields with legacy-row normalization defaults.
- [ ] Record `escalate` as an additive leg fact (`control-escalation-recorded`) and make the guard decision switch exhaustive. **Do not add a decision value** (ADR A3-12).
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
- Modify: `packages/remote/src/contracts/catalog.ts` / package barrel as needed
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

**Migration operator path (ADR A5-21 gap closed; the plan previously stated the outcome but named no surface).** There is **no product surface** that migrates a Blueprint: the v8 remote surface exposes `catalog.list/get` and `override.*` / `team.*` only, the blueprint registry is append-only and hash-verified, and hot-rebind is post-Alpha.4. So an existing Team is migrated by one of exactly two operator actions, and PR7's runbook must say which one it exercised:

1. **Author a v3 Blueprint file** into the mutable `blueprintDir` (`src/plugin/host.ts:602,1692`) — reachable today by hand, and by `scripts/blueprint-authoring.mjs` once its emitted skeleton stops saying `schemaVersion: 1` (`:92`, pinned by `packages/testkit/test/bp1h-blueprint-authoring.test.ts:95,128,149`) — then **create a new Team**. This is the sanctioned path for the stage.
2. **Edit the inline anchor in the plugin row config** (`src/plugin/host.ts:597`) for a Team whose Blueprint is inline. Hand-editing only; no tool does it in Alpha.4.

Anything else — rewriting a registry row, re-hashing, or hot-swapping a running Team's Blueprint — is out of scope and would break the hash-verified immutability the registry exists to provide. An unmigrated v1/v2 Team keeps working through PR1–PR6 provided the dual algebra of A5-12 holds and `inspect.ts` keeps listing v1/v2 sources (A3-11); its start behaviour is the warn-and-acknowledge row of §21.1 (A5-10).

**Parallel lane D — final acceptance/security matrix** (owning file `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts`, ADR A5-14)
- [ ] Add/assemble a single Alpha.4 acceptance suite that pins:
  - v3-only migration;
  - expansion-plane no-match zero authority (and its counterpart: approval-plane absence imposes no narrowing);
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
4. targeted security reviewer for **every** PR — PR0a (category-map fail-closed read plane), PR0 (corrupt-read / fail-closed path), PR1 (ceiling algebra), PR2 (evaluation), PR3 (case + escalation), PR4 (routing), PR5 (proposals), PR6 (principal derivation + intervention), PR7 (cutover);
5. merge only after all blocking findings are resolved.

Do not merge PR N+1 before PR N's reviewed interfaces are on `master`, except that A4-PR4 and A4-PR5 may be developed concurrently from the A4-PR3 interface freeze as described above.

# Expected Stable Plugin State After Each Merge

**After A4-PR0a:** a Team that abandoned an inline control request can read its ledger projection again, and every production-written fact type is registered behind a closed-set test.

**After A4-PR0:** plugin behaviour identical; a durable proposal fact family exists, reads strictly, and is categorised in the ledger projection.

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
- [ ] The real shared-file risk set — `src/plugin/root.ts`, `src/plugin/live/agent-bindings.mjs`, `governance/permission-mutation.ts`, `control/service.ts`, `operation-permission/pre-execute-adapter.ts`, `governance/service.ts` — is serialised behind a coordinator commit; parallel lanes never own them (Amendment A2 addenda).erfaces before consumers run in parallel.
- [ ] Effective-ceiling semantics replace existential envelope coverage everywhere by PR7.
- [ ] Both operation and mutation approval use the same RuntimeAuthority model.
- [ ] Capability/environment failure never enters approval routing.
- [ ] Intervention remains projection/router only.
- [ ] Legacy control vocabulary is explicitly retained and explicitly placed on the post-Alpha.4 cleanup list.
- [ ] Final cutover removes transitional v1/v2 branches rather than leaving hidden legacy semantics.

---

## Amendment A1 (2026-10-07) — execution addenda

Normative; supersedes the sections above on conflict. Review provenance: `dev/agent-workflow/evidence/alpha4-governance-review/REVIEW-ROUND-1.md`.

### A1.1 Protocol precedence and authority

- The execution protocol precedence ruling (this plan governs; ROUTER_RULES model pinning, per-Gate 3-reviewer composition, and the per-task ≤3-execution cap are superseded where in conflict) is recorded in `docs/ROUTER_RULES.md` §0 and `AGENTS.md`. Implementation mechanics run on the superpowers skill set installed in the global skills root (`subagent-driven-development`, `executing-plans`, `dispatching-parallel-agents`, `test-driven-development`, `using-git-worktrees`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion`).
- Push/merge authority: the user's 2026-10-07 instruction covers pushing task branches and merging **A4-PR0a, A4-PR0 and A4-PR1…A4-PR7 into `master`** as each PR passes this plan's gate, plus the Alpha.4 planning-docs PR. A4-PR0 is not an extension of that authority: it is a task of the plan the user instructed us to execute to completion, inserted by the review round as the smallest durable substrate the other PRs all need, and it changes no product behaviour. `stable` is out of scope; force-push remains forbidden; each merge is recorded in `SESSION_ROUTER_LOG.md` with its gate receipts.
- Review convergence cap: three review rounds per PR; a fourth is a `BLOCK` per ROUTER_RULES §5, not another attempt.

### A1.2 Baseline discipline corrections (final — supersedes the earlier capture in this section)

The authoritative record is `dev/agent-workflow/evidence/alpha4/baseline/BASELINE.md` (five consecutive full runs on the same tree; Linux, node v24.21.0, vitest 4.1.11). Numbers quoted anywhere in this plan are the **final** row below.

| capture | files | failing files | tests | passed | failed | identities |
| --- | --- | --- | --- | --- | --- | --- |
| as recorded (first capture, HEAD `838e7711`, base `2b86ee42`) | 456 | 13 | 5383 | 5355 | 28 | 33 |
| **FINAL, post-cleanup, modal of 5 runs** | **456** | **10** (7 named + 3 collection) | **5418** | **5398** | **20** | **23** (20 TEST + 3 FILE) |
| PR #62's recorded debt (other host, `4e2d7976`) | 455 | 9 | 5399 | 5380 | 19 | — |

1. **The baseline is now citable, and it is PR #62's debt plus exactly one identity.** Recorded → final removed 10 identities and added none; the `+35` test count is `p6t1-delegate` (15) + `p8s6-principal` (20), which previously failed at collection and contributed zero tests. Against PR #62's accepted debt the final set is identical except `rc2-kit-pin-hygiene` H2. All three collection-error texts reproduce PR #62's verbatim.
2. **Three previously-unexplained groups are all environment residue, not code** (proof in `BASELINE.md` §3–§4, `reproduce-residue-cause.log`): `p6t1-delegate` + `p8s6-principal` (deterministic-basename scratch dir under `packages/testkit/test/.tmp-fault/` keeping a stamped `team_domain` from an interrupted run ⇒ `TEAM_DOMAIN_EXISTS` at `storage/repositories/team-domain.ts:280-284`) and `a2c7-subtree-matcher`'s 8 `TypeError … decisionKind` failures, which are **symptoms**: a swallowing catch at `a2c7-subtree-matcher.test.ts:1019-1021` hides the one poisoned `TEAM_DOMAIN_EXISTS`, leaving `FLOWS.*` undefined. Reproduced causally (plant the world ⇒ exact recorded identities; remove ⇒ 46 passed). The POSIX-vs-Windows hypothesis is refuted: the comparison record is Linux too, and every OS-sensitive lane in that file is among the 23 passing. Nothing was fixed; cleanup only.
3. **Pre-run protocol is now mandatory for any capture** (`rm -rf packages/testkit/test/.tmp-fault/`, then capture twice); an interrupted run self-poisons the next one through fixed scratch basenames (~140 such call sites exist; the repo already documents the hazard at `rmr-create-or-open-boot.test.ts:217-220`).
4. **Named flake allowance** — additive-only, so it can never mask stable debt. Identities here may be re-run in isolation before being treated as blocking: `p6t1-parallel.test.ts::P6-T1 P1: N=2 same-template parallel activations…` ×2 (a genuine flake, 1/3 **isolated** runs; not root-caused), plus the two whole-tree hygiene-scanner ENOENT races while `packages/testkit/test/.tmp-fault/` churns (`rc2-kit-pin-hygiene` H2 3/5 full runs, `rc2-kit-preset-seam` P6 2/5). Measured by dogfooding `scripts/fail-set.mjs` on five runs of one tree: 24/23/25/24/23 identities. `fail-set.mjs diff` exits non-zero only on identities outside the baseline union — it never re-runs anything itself.
5. **`scripts/fail-set.mjs` (owned by A4-PR0) is format-locked to `BASELINE.md` §7** and proven byte-identical to both committed identity files (33-line recorded, 23-line final). Contract: two line shapes `TEST <relpath>::<fullName>` / `FILE <relpath>::COLLECTION-OR-UNHANDLED`; `<fullName>` copied **verbatim**; repo root = explicit arg, else cwd — never longest-common-prefix (it strips `packages/` and silently breaks comparison); identities must not depend on which checkout produced the report, so a `<repoRoot>/.worktrees/<task>/` prefix is elided (PR #62's debt was captured in a worktree and did not line up with root runs for exactly this reason); raw vitest JSON stays gitignored, the identity list plus `.summary.txt` are the record.
6. **New named debt with an owner (PR0 lane): the two whole-tree hygiene scanners are mis-scoped.** `rc2-kit-pin-hygiene.test.ts:29-38` (`sourcesUnder`, `statSync` at `:35`) and `rc2-kit-preset-seam.test.ts:73-82` (`walkSources`, called at `:264`) walk **gitignored** trees, skip `.tmp-faultscratch` while the real base is `.tmp-fault`, and therefore scan retained DSH_HOME worlds: 21 306 files, **954 offenders, all under `tests/homes/`** (53 worlds × 18 `.mjs` — historical snapshots of this repo's own tree inside 0.1.7-rc.1-era spill worlds), zero offenders elsewhere. Those worlds are evidence-registered in tracked files, so they cannot be deleted; the fix is the one this plan already needs for its own gate — scope both walkers to tracked sources (or skip `tests/homes/`, `.tmp-fault`, and unreadable/dangling entries). Until then H2 is red in any tree that retains worlds and green in a fresh worktree, which is precisely the kind of environment-dependent gate this plan forbids.
7. **`pnpm smoke:composition` is amended**: the client leg is red at base by design (upstream `dsh-client-ui-primitives` publishes no runtime deps ⇒ `clsx` crash). The leg is run and recorded, and its known-red status is not treated as an Alpha.4 regression; removed by PR7.
8. Every **PR0a, PR0 and PR1–PR7** gate additionally runs `pnpm build`, `pnpm build:composition`, and `pnpm check:artifacts` **in the same commit** (dist co-commit rule), recomputes the `p4t6` inventory pin when `packages/**` file counts change (PR0 holds that authority first), and requires a RED-before-GREEN receipt.
9. Temporary-semantics disclosure now has named targets: a PR-body section, a `docs/STATUS.md` line, and an evidence receipt — all removed by PR7.
10. **Every gate also runs `pnpm -r run typecheck` (added 2026-10-07 in the A4-PR0a follow-up, and it is not optional for PR0–PR7).** Measured reason, not caution: `build` is `pnpm -r run build` = `tsc -p tsconfig.build.json`, whose `include` is `src` (+ two named domain lanes), so any module that nothing in `src/**` imports — which is every Alpha.4 lane module until the PR that wires it (`governance/proposal-store.ts` in PR0, `domain/authority-envelope/**` and `runtime/governance/authority-ceiling.ts` in PR1) — is never typechecked by `build`; `packages/runtime/tsconfig.json` includes `['src','test','vitest.config.ts']`, so the ONLY thing that typechecks such a module is the package `typecheck` reaching it transitively through its own test import; and vitest transpiles without typechecking at all. The hole was proven on the first PR of the phase: the A4-PR0a guard test merged green carrying 27 `noUncheckedIndexedAccess` errors that no configured gate could see. `pnpm exec eslint <changed files>` runs with it, because the a3p3 import-hygiene rules are the independent enforcement of the A4-1 / A3-6 import bans.

### A1.3 Ownership and file-list extensions (fixes the plan's own file-disjoint rule)

- **PR1**: add the v3-missing-`permissionMutationEnvelope` RED test (the field is optional today — ADR A1-19). Existing golden contentHash pins must stay byte-stable; no re-pin in PR1.
- **PR3**: exactly one writer owns `control/types.ts` and `control/service.ts`; lane B's derivation and terminal-vocabulary work moves into new modules rather than sharing those files.
- **PR4**: file list gains `packages/tools/src/tools.ts` (reachable `escalate`, pending list spanning cases — A1-11) and the guard-side consumption recheck (A1-14).
- **PR5**: exactly one writer owns `governance/service.ts` and `permission-mutation.ts`; the batch planner moves to its own module.
- **PR6**: file list gains `packages/runtime/src/plugin/s6-principal.ts` (explicit per-method principal derivation, no fallback — A1-2) and `packages/remote/test/p8t3-version.test.ts` (the `[1..7]` pin that makes the 1–8 regression possible). `intervention/projection.ts` has one writer; warning aggregation gets its own module; `src/plugin/root.ts` wiring is a coordinator-owned commit.
- **PR7**: scope extends to the boot-anchor and reference-less-row cases of A1-20, alias deletion, and the golden contentHash re-pin.
- **PR4 ∥ PR5 rebase collision set** (name it in the PR5 rebase step): `packages/runtime/src/plugin/root.ts`, the `p4t6` inventory pin, `packages/runtime/dist` mirrors, and the log/graph bookkeeping files.

### A1.4 Review completion

- The targeted security reviewer applies to **all nine** PRs (PR0a, PR0, PR1…PR7), not five: PR1 owns the ceiling algebra behind invariants 1–3, PR6 owns the first new command surface.
- Before PR1, write the **invariant → PR → test matrix** covering ADR §29 plus A1-1…A1-22; each PR body carries its rows. Invariants **#6** (a policy `deny` never mints an approval case) and **#16** (no authority-bearing surface derives its principal from payload data or a default branch) must have named tests, not prose.
- Per-PR evidence directory: `dev/agent-workflow/evidence/a4-prN/` (RED/GREEN receipts, baseline diff, lane receipts, review findings and closures).
- The final commit of every PR carries the orchestration bookkeeping delta: a `SESSION_ROUTER_LOG.md` append and the `graph.yaml` node state for that PR.

### A1.5 Environment-gated acceptance lanes (pre-adjudicated)

PR6 and PR7 real-host / Chrome lanes follow the recorded precedent: attempt the lane; if the environment blocks it (unbuilt host runtime, no usable browser sandbox, refused userns), record a diagnosis plus a **non-blocking constraint** in evidence and never claim live acceptance for it. Before PR6, pre-stage what this environment can: built 0.2.0-rc.2 host in `tests/deepseek-harness-test-use`, mock model deployed, and a runnable browser under the existing port/sandbox discipline — or route the lane to a dedicated environment session and import its evidence.

### A1.6 Deferred human acceptance (user ruling, 2026-10-07)

The Alpha.3 permission-surface human acceptance checklist (the 9-step pass in `ALPHA3-PERMISSIONS-USER-FACING.md` §8) is **accepted as a deferred precondition**: there is no useful entry point for it in the current Alpha.3-only UI, so it becomes an Alpha.4 acceptance item executed against the PR6 Permission Administration surface. "Merge is not deployment" continues to hold until that pass is recorded.

### A1.7 Test-world migration policy (PR7 input)

Re-audited in this environment on 2026-10-07 (the earlier "88 worlds / 3 disposable" audit **did not reproduce** and its method was invalid here — see the audit-method note), so the policy is restated against verified facts.

Verified inventory of `tests/homes/` = **94 entries**, not 88: **88 named worlds** plus **6 dot-prefixed entries**, of which three are infrastructure caches rather than worlds — `.playwright-browsers` (**must be kept in this environment**: `$HOME/.cache` is read-only, so it is the only working Playwright browser path), `.browsers` (267 MB), `.browser-libs` — and three are durable test worlds: `.dsh-test-p2t1` (the characterization default), `.dsh-test-rc2b`, and `.probe-scratch` (24 KB, zero references by name or prefix — **removed** in this round). Total footprint before cleanup: 9.7 GB.

Policy: **retain every named world** through PR7 and let them fail closed as migration-required at cutover; **no world is migrated implicitly**. Named-world prefixes all carry real references (each group appears in 2–59 tracked code/kits/script/doc files and 2–488 evidence files); the single group whose *prefix* has zero code references (`u8-017rc1-probe`) is still referenced by 13 evidence files, so it is retained like the rest. The two worlds a kit genuinely *depends on at run time* — the `pr-b` default seed world and `.dsh-test-p2t1` — are additionally de-risked by making `pr-b`'s `--seed-world` required and adding a seed-world regeneration kit, so the dependence stops being a single point of failure.

Removable set = **probe scratch only**, and it must be proven unreferenced first. Two such directories were removed this round with evidence: `tests/dsh-homes/.probe-coldstore` (207 MB, gitignored, zero tracked references — and actively breaking a gate: `packages/testkit/test/rc2-kit-pin-hygiene.test.ts` ENOENTs while stat-ing every repo file) and `tests/homes/.probe-scratch`.

**Audit-method note (binding for later rounds)**: `ripgrep` is **not installed** in this environment, and `rg`-based scans therefore return silent all-zero false negatives (`which rg` → nothing; nothing in this repo shells out to `rg`, so its absence is not a suite-failure cause). Any world/reference audit here must scan `git ls-files` output with literal substring matching, as this audit did, and must count dot-prefixed entries explicitly — `ls -d */` silently drops them, which is how "88 worlds" was produced.

## A2 addenda (2026-10-07, architecture lane) — task and file-list corrections

**New Task 0 / A4-PR0 — Durable Governance Proposal Substrate** (lands first; nothing else in Alpha.4 has anywhere to put an authority-bearing durable record).

**Files (corrected in place by A3-6/A3-7; the original "new `factType` in `packages/storage/schema/ledger.ts`" was a no-op and is withdrawn — `factType` is an open hygienic string at `storage/schema/ledger.ts:15-17, 87-88` and `repositories/ledger.ts:139, 241` whitelist nothing, so no storage edit is needed):**
- `packages/runtime/governance/proposal-store.ts` — append + strict reader + typed `corrupt-record` outcome for factType `governance-proposal-recorded` (append-only; supersession by a newer fact, never a mutation);
- its typed error-code home: a **lane-local** closed table `packages/runtime/governance/proposal-codes.ts` (ADR A4-1 — the earlier "the plugin's typed code module" wording is withdrawn: no lane value-imports from `src/plugin/**`);
- `packages/runtime/src/plugin/projection-source.ts` — the `FACT_TYPE_CATEGORY` entry mapping the new fact type to the existing `policy` category (an unregistered type throws `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` at `:766` and breaks the whole ledger read plane, not one row);
- `scripts/fail-set.mjs` — the A1.2.2 baseline-diff tool, which exists today only in an unmerged worktree and was owned by no PR;
- the `p4t6` scannable-inventory pin recompute (`packages/testkit/test/p4t6-session-event-scan.test.ts:1735-1736`; `:52` is the `it()` title, not the pin), which PR0 is now expressly authorised to change;
- round-trip, restart-survival and corrupt-record tests.

Gate (A4-7, two legs): round-trip green across a reopened store; payload-level corruption of an entry-valid row yields a typed corrupt outcome naming path/field/sequence while the row is still present in `list()`, and entry-level corruption is asserted as a **throw** from the durable read, never as an empty result; ledger projection still serves every category with `sum(byCategory) === factCount`; no new store, no storage schema change, no change to the appended-last stamp contract.

**PR0 lane C — baseline integrity (added by the classification round; this is what makes every PR gate in A1.2 mechanically honest):**
- [ ] Scope the two whole-tree hygiene scanners to tracked sources — `packages/testkit/test/rc2-kit-pin-hygiene.test.ts:29-38` (`sourcesUnder`, `statSync` at `:35`) and `packages/testkit/test/rc2-kit-preset-seam.test.ts:73-82` (`walkSources`, called at `:264`): they currently walk gitignored trees, their skip list names `.tmp-faultscratch` while the real scratch base is `.tmp-fault` (`packages/testkit/fault-injection/file-seam.mjs:89`), and they therefore scan retained DSH_HOME worlds (21 306 files → 954 offenders, all under `tests/homes/`, 0 elsewhere) and die on mid-walk ENOENT. Neither world set may be deleted (evidence-registered in tracked files). RED: a scan whose offender list contains a `tests/homes/` path, or an ENOENT thrown against a concurrently changing tree. GREEN: offenders only from tracked sources, dangling/unreadable entries skipped, both files green in a tree **with** retained worlds.
- [ ] Adopt the capture protocol in A1.2.3 as a script or a documented two-command recipe, and record the named flake allowance (A1.2.4) beside the pinned identity file.
- [ ] Carry `scripts/fail-set.mjs` (branch `chore/a4-fail-set-tool`, `5710eff6`) into `scripts/`, keeping its byte-identity proof against both committed identity files.
- [ ] Commit.

## A3 addenda (2026-10-07, round 2) — these supersede the A2 addenda and every task body above on conflict

**PR0 is a real PR.** It joins the merge-order table, the review order (targeted security reviewer for the corrupt-read path), the A1.2.2 baseline-diff gate, the A1.2.5 gates (`pnpm build` + `build:composition` + `check:artifacts` dist co-commit + `p4t6` pin recompute + RED-first), the A1.4 evidence dir (`dev/agent-workflow/evidence/a4-pr0/`), and the Expected-Stable-Plugin-State list. **Ownership exception granted to PR0:** the `p4t6` scannable-inventory pin (`packages/testkit/test/p4t6-session-event-scan.test.ts:52`, currently 971) is recomputed by whichever PR changes `packages/**` file counts, starting with PR0 — otherwise PR0 cannot pass its own gate without breaking the single-writer rule that assigned `packages/testkit/**` to PR1.

**PR0 file list, corrected.** `packages/storage/schema/ledger.ts` is **dropped** (no storage edit is needed: `factType` is an open hygienic string, the repository whitelists nothing). It owns instead: `packages/runtime/governance/proposal-store.ts` (append + strict reader + typed `corrupt-record`), the factType name `governance-proposal-recorded`, its typed error-code home, the **`FACT_TYPE_CATEGORY` registration** in `packages/runtime/src/plugin/projection-source.ts` (target category `policy`; an unmapped fact type throws `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` and breaks the whole ledger read plane), and **`scripts/fail-set.mjs`** — the baseline-diff tool A1.2.2 requires, which exists today only in an unmerged worktree (`.worktrees/a4-fail-set`, `2a0ff1ef`, self-test passing and verified not to move the p4t6 pin) and is owned by no PR.

**Per-PR corrections on top of the A2 addenda.**
- **PR1** — implements the config-shaped AST winner `{ kind, path | fingerprint }` with the runtime `{ kind, resource }` shape demoted to a boundary adapter, and the structural re-declaration of the effect vocabulary in `packages/domain` with a mutual-assignability test; adds the new module directory to `packages/domain/tsconfig.json` include (else typecheck never sees it) and adds `domain` to the lane-hygiene walk roots (today `['runtime','tools','remote','client']`); owns the two §7.4.1 ceiling-reachability tests.
- **PR3** — specifies the escalation leg fact `{ approvalCaseId, legOrdinal, previousRequestId, escalatedBy, reason }` and the caller-visible `escalated` outcome for the inline waiter; its import pin must disambiguate the two same-named `CONTROL_DECISION_VALUES` constants by module path (`control/types.ts:169` re-exported at `control/index.ts:118` vs `admission/actions.ts:127` re-exported at `admission/index.ts:91`), plus the third literal decision list in `remote/src/handlers/team.ts`.
- **PR4** — additionally owns `packages/runtime/action-router/router.ts:615-624` (a second consumer hard-coding `decision.decision !== 'allow'`) and `packages/runtime/operation-permission/errors.ts` if new routing states emit typed denials; owns the §21.4 rise tests **and** the exec dual-gate v3 tests (both branches: matching shell rule narrows, no shell rule does not).
- **PR5** — the single-writer gate is "one kernel writer + one sanctioned port adapter + no third call site", since the tree already has two sites (`governance/service.ts:707`, `permission-governance/overlay-repository.ts:71`).
- **PR6** — the Team-start governance gate is implemented on the real path (`plugin/root.ts`, `plugin/s6-remote.ts` own `ensureRootLive`; `activation/checks.ts` and `admission/requirement-gate.ts` are unrelated to it), with no "defer it" escape; also owns the client mapping so a `governance-proposal-recorded` row is never rendered as a generic uncategorized ledger entry (`client/src/model/ledger-adapter.ts:330-337`).
- **PR7** — additionally owns `packages/runtime/src/plugin/blueprint-authority.ts` (the **earliest** construction-time anchor parse, called from `host.ts:1695`), `plugin/root.ts:883`, `packages/domain/blueprint/src/inspect.ts` (kept able to list v1/v2 sources so unmigrated blueprints stay discoverable), `packages/tools/src/tools.ts:961`, the testkit/harness fixtures (`packages/testkit/domain/src/scenario.ts:177,183`, `packages/runtime/root-binding/harness/blueprint-source.mjs:30`), and the static scan `scripts/verify-blueprint-version-clean.mjs` enforcing the verified 19-file fixture inventory. **Lane C7 correction:** `scripts/fixtures/composition-smoke/team-blueprint.yaml` does not exist and `scripts/composition-smoke.mjs` contains no blueprint — both struck; the authoring helper `scripts/blueprint-authoring.mjs:92` and the **two** golden contentHash pins (`a3p4-pr4-production-entry-regression.test.ts:2115`, `pr-f-closure-smoke.mjs:389`) are in scope instead.

**Invariant→test matrix now has an owner.** PR1 writes the matrix (ADR §29 + A1/A2/A3) into `dev/agent-workflow/evidence/a4-pr1/INVARIANT-MATRIX.md` before its first GREEN, names a test per invariant, and carries invariant #6 — which already has real tests (`packages/runtime/test/a5a-pre-execute.test.ts:962,1208`) but had no owning PR.

**Test-world note for PR7:** the corrected `tests/homes` inventory and audit method (94 entries; `ripgrep` absent in this environment so scans must use `git ls-files` + literal matching; only probe scratch is removable) is in A1.7.

## A4 addenda (2026-10-07, PR0 surface-survey rulings)

**PR0 design rulings (ADR A4-1…A4-7 — they settle what the surface survey could not):** error codes are a **lane-local** closed table (`governance/proposal-codes.ts`, shaped like `PERMISSION_MUTATION_ERROR_CODES`); no value import from `src/plugin/**`, because `src/plugin/types.ts` is type-only and no lane in the tree has such an edge (A4-1). A proposal append **is** generation-bearing (`team_sessions.generation`, the S1-A stamp counter) and that is safe, because governance CAS compares the **overlay** winner generation — a different counter; the module doc block must say so (A4-2). Bind proposals with `baseGeneration` + `baseSnapshotId` and let the existing `previous-snapshot-id-mismatch` / `generation-conflict` refusal perform the revalidation: **no content hash, no second `node:crypto` owner**, and `baseGeneration: 0` + `baseSnapshotId: null` is the empty-overlay case (A4-3). Name the subject `targetMemberInstanceId`, never a `FACT_ADDRESSING_KEYS` name, with a leg pinning that disposed-member digests do not move (A4-5). Do not re-export from `governance/index.ts` (nothing emits, `check:artifacts` stays green; PR5 wires and co-commits dist), do not import `./permission-mutation.js`, add no method to `createGovernanceMutationService`, and use structural writer/reader ports rather than importing the ledger repository type (A4-6). The corrupt-record gate is **two legs** — typed corrupt outcome for an entry-valid/malformed-payload row with the row still listed, and an asserted throw for entry-level corruption, never an empty result (A4-7).

**Required merge order becomes: A4-PR0a → A4-PR0 → A4-PR1 → A4-PR2 → A4-PR3 → A4-PR4 → A4-PR5 → A4-PR6 → A4-PR7** (PR4 ∥ PR5 concurrency rule unchanged).

Per-PR corrections to the file lists above (these supersede them):

- **PR1**: grammar/AST files move to `packages/domain` with a runtime adapter (A2-3); add the overlap + monotonicity matrix as a blocking RED-first test; add the byte-identity pins for v1/v2 hashable views (A2-11) and the not-policy-referenceable test (A2-12); add the governance lane-hygiene test to the PR list — its allow-list is part of the frozen interface and every new kernel consumer must appear in it; name the meaning-changed Alpha.3 tests in the PR body (`a3p3-revoke-reveal-semantics.test.ts:530`, `a3p4-r4-authority-binding.test.ts:164-187,466`, `a3p4-permission-lifecycle-e2e.test.ts:531,574`).
- **PR2**: disclose the dual algebra (v1/v2 existential vs v3 ceiling) and add the lane-hygiene test; update the `team_grant_permission` / `team_revoke_permission` description strings that assert existential coverage, with their description pins (A2-18).
- **PR3**: escalation ships as an additive leg fact **plus a terminal `deny` decision row carrying the additive reason `escalated`** so the inline waiter resolves instead of hanging (ADR A5-5), with an exhaustive guard switch and the "escalate ⇒ zero guard authorization" RED test (A2-1); its file list **must** include `packages/runtime/src/plugin/projection-source.ts` (register `control-escalation-recorded` → `policy`) or the closed-set guard test from PR0a fails (ADR A5-6); no new Control request kind (A2-7); `terminalReason` rather than a new stale value (A2-8); strict parsing (A2-9). The five files that duplicate the decision vocabulary (`remote/src/handlers/team.ts`, `remote/src/contracts/params.ts`, `tools/src/tools.ts`, `client/src/ui/TeamLedger.tsx`, `client/src/ui/TeamView.tsx`) stay at the v7 surface, exactly as `stale-denied` did — say so in the PR body instead of adding them.
- **PR4**: the "no v1/v2 behavior change" test must enumerate the exec dual-gate downgrade path, not only kind selection (ADR lane note 24); the coordinator lands the `src/plugin/root.ts` wiring commit **before** PR4 and PR5 open in parallel.
- **PR4/PR5 serialisation**: `packages/tools/src/tools.ts` is owned by **PR4**; PR5 rebases onto PR4, and the file joins the rebase collision set below — the two PRs both named it (ADR A5-11).
- **PR5**: consumes the PR0 substrate (and discloses that between PR5 and PR6 a proposal row renders as a generic uncategorised Event client row, ADR A5-7); adds the structural "exactly one overlay `.append(` call site" test (A2-16).
- **PR6** (superseded by A3-13/A5-10 — the `activation/checks.ts` and `admission/requirement-gate.ts` assignment is **struck**; they are not on the `ensureRootLive` path): the Team-start governance gate is deferred (A2-15).
- **PR7**: file list additionally owns `packages/runtime/src/plugin/host.ts` (construction-time anchor parse, A2-10) and gains **lane C7** covering `tests/kits/**` and `scripts/fixtures/**` — including `pr-f-closure-smoke.mjs`'s own `schemaVersion: 1` fixture and its `V1_ANCHOR_HASH_PRE_PR_E` golden hash, `rc2-real-host-smoke.mjs`, and `scripts/fixtures/composition-smoke/team-blueprint.yaml`. Those kits sit outside the vitest gate, so nothing else will catch them.

**Honest shared-file ranking** (replacing the plan's earlier "two highest-risk files" claim): `src/plugin/root.ts` (3660 ln), `src/plugin/live/agent-bindings.mjs` (4911 ln), `governance/permission-mutation.ts` (1338 ln), `control/service.ts` (2781 ln), `operation-permission/pre-execute-adapter.ts` (1696 ln), `governance/service.ts` (729 ln). PR4 and PR5 both touch `root.ts`, and PR1/PR2/PR5 all touch `permission-mutation.ts`: serialize those files behind a coordinator commit; parallel lanes never own them.

### Authoritative task bodies for A4-PR0a and A4-PR0 (ADR A5-13; these supersede the roadmap rows and every earlier PR0 sketch)
### Task 0a / A4-PR0a: Ledger Category Closure (defect fix, first)

**Branch:** `fix/a4-pr0a-ledger-category-closure` · **Plan:** `docs/plans/issue-fix/a4-pre0-ledger-category-closure.md` · **ADR:** A4-4

**Purpose:** stop one abandoned inline control request from permanently breaking `team.getProjection` for that Team, and make "new fact type, forgotten registration" a red test instead of a broken read plane.

**Files:**
- Modify: `packages/runtime/src/plugin/projection-source.ts` (`FACT_TYPE_CATEGORY` += `control-request-abandoned` → `control`)
- Modify: `packages/client/src/model/ledger-adapter.ts:89-129` (client category symmetry; the map, not the `:333` lookup or the `:748` renderer)
- Modify: `packages/testkit/test/p4t6-session-event-scan.test.ts:1735-1736` (inventory recompute, A5-17)
- Create: `packages/runtime/test/a4pr0a-abandon-projection-closure.test.ts` (RED-first: abandon → read projection through the production read port)
- Create: `packages/runtime/test/a4pr0a-fact-type-closed-set.test.ts` (guard test; tracked-source scan only)

- [x] Write the RED test: create a Team, raise an inline control request, abandon it through the production path, then read the projection through `createTeamDomainReadPort`. Assert it **throws** `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` today, and assert the fixed behaviour (all categories served, `sum(byCategory) === factCount`).
- [x] Register `control-request-abandoned` in `FACT_TYPE_CATEGORY` under the frozen `control` category. **Do not** add a ninth category. Independent sweeps confirm this is the only unregistered production-written fact type today (A5-16 addendum), so the guard should go green on this one entry.
- [x] Add the client category entry — **the writer of a fact type owns both category maps** (ADR A5-22); PR6 keeps the rendering/`INTERNAL_FACT_TYPES` layer — and check `INTERNAL_FACT_TYPES` semantics for whether an abandonment row belongs in the Events view (it currently renders via a `case` at `ledger-adapter.ts:748`).
- [x] Land the **closed-set guard test** (ADR A5-16): derive the fact types production sources write by **resolving identifiers** — same-file and imported constants, `OP_TO_FACT_TYPE`-style tables, and typed-parameter call sites — not by scanning `factType:` literals (only six sites are literals; a literal scan passes on the commit that contains this bug). Scan `git ls-files` output for `packages/**` sources, skipping `dist`, `node_modules`, `.tmp-fault` (A1.2.6: tracked sources only). Assert each derived type is registered in **both** the host map and the client category map, assert the eight-category set is unchanged, assert the derived set **contains** `control-request-abandoned`, `governance-proposal-recorded` and `control-escalation-recorded`, and prove non-vacuity once by mutation (A5-16 iii).
- [x] Recompute the `p4t6` scannable-file inventory at `packages/testkit/test/p4t6-session-event-scan.test.ts:1735-1736` (plus the `:52` title and `:1716-1732` arithmetic note): this PR adds two test files, and the recompute authority now starts here (ADR A5-17), continuing with every later PR.
- [x] Co-commit emitted `dist` if the build output changes (`pnpm run check:artifacts`).
- [x] Capture the baseline per A1.2.3 (delete scratch, capture twice) and confirm the failing set moved **only downward**.
- [x] Commit.

**Gate:** the RED test is green; the guard test fails when a fact type is deliberately left unregistered (prove it once by mutation); `sum(byCategory) === factCount`; no category added; no storage schema change.

### Task 0 / A4-PR0: Governance Proposal Substrate

**Branch:** `feat/a4-pr0-proposal-substrate` · **ADR:** A3-5, A3-6, A4-1…A4-7, A5-13 · **Depends on:** A4-PR0a

**Purpose:** a durable, restart-stable proposal record with an honest corrupt-read contract, and **zero product behaviour change** — nothing in the plugin calls it yet.

**Files:**
- Create: `packages/runtime/governance/proposal-store.ts` — the frozen record type (ADR A5-13): `targetMemberInstanceId`, `baseGeneration: number`, `baseSnapshotId: string | null`, `desiredEffect`, `authorityEnvelopeAst`, `requiredAuthority`, `caseFingerprint`, `status`, `recordedAt`; **key-omitted** optionality (the durable writer rejects `undefined`). **Field types are NOT frozen by this line**: `requiredAuthority` and `authorityEnvelopeAst` name types that arrive in PR2 and PR1, so PR0 persists the durable vocabulary and interprets nothing — see ADR Execution-round corrections X2 and X3, which bind here.
- Create: `packages/runtime/governance/proposal-codes.ts` — lane-local closed error-code table (A4-1); no value import from `src/plugin/**`.
- Modify: `packages/runtime/src/plugin/projection-source.ts` — register fact type `governance-proposal-recorded` → `policy` (A3-7), so PR0a's closed-set guard stays green.
- Create: `packages/runtime/test/a4pr0-proposal-store.test.ts` — round-trip + restart/reopen stability.
- Create: `packages/runtime/test/a4pr0-proposal-corrupt.test.ts` — the two-leg corrupt gate (A4-7).
- Create: `packages/runtime/test/a4pr0-proposal-generation.test.ts` — pins A4-2: a proposal append advances `team_sessions.generation` and does **not** disturb the governance overlay CAS (`OVERRIDE_GENERATION_CONFLICT` semantics).
- Carry: `scripts/fail-set.mjs` from `chore/a4-fail-set-tool` @ `5710eff6` (lane C).

- [x] RED first: the three test files fail for the absence of the module.
- [x] Implement the store against structural writer/reader ports (no ledger repository type import, no `./permission-mutation.js` import, no new method on `createGovernanceMutationService`).
- [x] **No re-export** from `governance/index.ts` (A4-6): nothing emits, `check:artifacts` stays green, PR5 wires and co-commits dist.
- [x] Confirm the `p4t6` inventory is already correct from PR0a and recompute only if this PR adds more scannable files (A5-17: the authority is continuous, the recompute is per-PR).
- [x] Register `governance-proposal-recorded` in the **client** category map too (ADR A5-22: the writer owns both maps), so PR0a's guard does not go red on a file PR0 was not allowed to touch.
- [x] Scope the two whole-tree hygiene scanners to tracked sources (lane C, A1.2.6).
- [x] Baseline per A1.2.3; the failing set moves only downward; named-flake allowance is additive-only (A1.2.4).
- [x] `pnpm build && pnpm run build:composition && pnpm run check:artifacts` green; commit.

**Gate:** round-trip + restart green; corrupt gate has both legs (typed corrupt outcome with the row still listed; entry-level corruption asserts a throw, never an empty read); a proposal append advances the session stamp and leaves the overlay CAS intact; plugin behaviour byte-identical (no product surface change); baseline moves only downward.

## A5 addenda (2026-10-07, round 3) — these supersede the A2/A3 addenda and every task body above on conflict

Round 3 was the last permitted round (ADR A1.1 cap). Security returned BLOCK and architecture returned SUPPLEMENT; every finding was re-verified against code before being adopted, and two reviewer claims were refuted rather than absorbed (ADR A5-8's `minimumAuthority` item, and the "19-file" count). Closures live in ADR **Amendment A5**; the task-level consequences are:

- **Ceiling tests are positional (A5-1).** PR2 lane A's RED matrix must pin `bindingDocs` per role — Leader capped by both documents, **Human User capped by `teamHardEnvelope` alone**, Human Admin uncapped — using the §7.4.1 cases. A test that caps a Human User with the mutation envelope contradicts ADR §15 and Task 2's own pinned line "Pin Human User ceiling = Team Hard envelope"; a test that caps Human Admin makes §3.2 unsatisfiable.
- **Exec dual-gate is a no-change item (A5-4).** PR4 must **preserve** today's fail-closed token-absence downgrade and pin both branches. My earlier A3-4 would have reversed production behaviour and let `{ rules: [] }` (maximally restrictive) execute Leader shell calls with no approval; that clause is withdrawn and the "residual" it disclosed is gone.
- **Escalation is two writes and wakes the waiter (A5-5).** PR3 lands the leg fact **and** a terminal `deny` decision row with the additive reason `escalated`; the decision vocabulary stays `allow | deny | stale-denied`. The RED test is writable because no escalation path exists at all today.
- **PR3 registers its fact type (A5-6)** in `projection-source.ts` in the same PR, under PR0a's closed-set guard.
- **PR0a is first (A4-4)** — see its task body above; it is a live Alpha.3 defect, not an Alpha.4 feature.
- **PR4 owns `packages/tools/src/tools.ts`; PR5 rebases** (A5-11) and joins the collision set.
- **PR5 discloses** the interim generic-Event rendering of proposal rows until PR6 owns the client mapping and `INTERNAL_FACT_TYPES` (A5-7).
- **PR7**: inventory is 18 under a defined predicate with two strikes (A5-9); `scripts/verify-blueprint-version-clean.mjs` is invoked by name in the gate; lane D owns `a4p7-v3-cutover-acceptance.test.ts` (A5-14).
- **Start gate (A5-10):** incompatible/unmigrated governance authority on a v1/v2 Team is warning-and-acknowledgeable; unreadable-or-corrupt is start-blocking. §21.1 now carries both rows; the earlier "binding row" quote was a phantom and is withdrawn.

