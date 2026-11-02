# R1 (BL-09) — approval / governance entry-point inventory

> Dated 2026-11-02. Work package **R1 = BL-09 "R1 审批/治理接管"** of
> `docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md` §3.1 and the
> `ALPHA5-SANDBOX-BACKLOG.md` BL-09 row. Companion evidence:
> `dev/agent-workflow/evidence/a5sf-reclaim/ASSET-RECLAMATION-REGISTRY.md` rows R1-a..R1-e.
>
> **Method.** Every row below was read in this worktree at `origin/master`
> `17ce7043089980fe1a2e56b29be12459bc74fc9f` plus the P1 lane (the P1 merge in that commit).
> `file:line` points at the declaration / the load-bearing call, not at the documentation.
> Classification vocabulary is the reclamation registry's A/B/C plus one disposition that only
> applies to this lane:
>
> - **CONSUME** — the new execution path must call it; it stays the one authority.
> - **KEEP (orthogonal)** — not a permission computation over the new two axes; keep working.
> - **RETIRE(P3/P4)** — a *duplicate permission computation* relative to the new single
>   `member-io-policy` compiler. **Not deleted here** (the plan schedules retirement in P3/P4;
>   deleting them now would break the still-live Alpha.4 operation-approval plane and the
>   evidence chain BL-11 depends on).
> - **ADAPT(P2+)** — mechanism survives but its interface is tied to the retired model.

## 1. The one approval / governance kernel (Alpha.4) — all **KEEP**, one **CONSUME**

| # | Entry point (path:line) | What it is | Disposition for the new lane |
|---|---|---|---|
| 1 | `packages/runtime/control/service.ts:1651` `createControlService` | The durable control-plane service (request / resolve / guard / consume). The only approval/authority service. | **CONSUME** — through its public `guardOperation` only. |
| 2 | `packages/runtime/control/service.ts:3240` `guardOperation` | Last-mile guard: verifies a durable allow for the EXACT scope, re-probes the live external hard policy, then **consumes the allow exactly once** under the per-team lock (`check-and-reserve`). | **THE SEAM** the new lane consumes as `AskApprovalAuthority`. Owns one-shot; the adapter holds no state. |
| 3 | `packages/runtime/control/service.ts:2141` `requestControl` | Creates the durable control request for a logical operation scope. | **KEEP** — the Alpha.4 pre-execute pipeline owns requesting; the new adapter deliberately does **not** request (`README.md` §"what remains for P2"). |
| 4 | `packages/runtime/control/service.ts:2555` `resolveControl` | Records the durable allow/deny/stale-denied decision on the request. | **KEEP** — the approval is decided by the existing review ladder, never by the new lane. |
| 5 | `packages/runtime/control/service.ts:5031` `readApprovalCaseState` | Reconstructs one approval case from durable rows (typed corrupt/absent outcome, never a guess). | **KEEP** — ApprovalCase read surface; future P2 chain evidence reads it. |
| 6 | `packages/runtime/control/service.ts:5055` `listOpenApprovalCases` | The open-case index. | **KEEP**. |
| 7 | `packages/runtime/control/service.ts:5583-5595` the `ControlService` object literal | The single object that exposes all of the above. | **CONSUME** the `guardOperation` member; no second facade is created. |
| 8 | `packages/runtime/control/types.ts:453` `ApprovalCaseIdentity` | Frozen case identity (spec 11.1). | **KEEP** — the decision identity the durable rows carry. |
| 9 | `packages/runtime/control/types.ts:548` `ApprovalCaseState` | Derived state of one case reconstructed from durable rows. | **KEEP**. |
| 10 | `packages/runtime/control/types.ts:710` `ApprovalCaseSummary` | The open-case summary shape. | **KEEP**. |
| 11 | `packages/runtime/control/types.ts:1502` `ControlOperationScope` | The exact, lossless scope an allow authorizes (root session, member, tool, correlation, optional fingerprint / authority point). | **CONSUME as the approval scope type** — the adapter forwards this exact object to `guardOperation`, after binding its `rootSessionId` to the required `expectedRootSessionId`. |
| 12 | `packages/runtime/control/types.ts:1694` `ControlDecisionRecord` | The durable decision row (allow / deny / stale-denied). | **KEEP** — the authority behind the verdict. |
| 13 | `packages/runtime/control/types.ts:1923` `ControlGuardVerdict` | The closed last-mile verdict (`allowed: true` + request/decision ids, or `allowed:false` + closed block reason). | **CONSUME as the approval decision type** — the adapter maps it, and maps `allow-consumed` to a typed refusal. |
| 14 | `packages/runtime/control/types.ts:1818` `CONTROL_GUARD_BLOCK_REASONS` | The closed block vocabulary (`no-request` / `request-pending` / `decision-deny` / `allow-consumed` / …). | **CONSUME** — the adapter treats every non-allow reason as a refusal (an `ask` is never autonomously allowed). |
| 15 | `packages/runtime/control/types.ts:2087` `ControlService` interface | The exported public service contract. | **CONSUME** structurally (`AskApprovalAuthority` is the exact `guardOperation` signature). |
| 16 | `packages/runtime/control/index.ts:203` + `:107-201` | The public barrel (service factory + all closed vocabularies). | **CONSUME** — the seam is already barrel-public; **no upstream patch, no private import**. |
| 17 | `packages/runtime/governance/authority-ceiling.ts:512` `mayReview`, `:566` `grantCeiling` | Alpha.4's rung ladder / ceiling walk for who may sign. | **KEEP (orthogonal)** — decides *who approves*, not *what I/O is permitted*. |
| 18 | `packages/runtime/governance/permission-approval.ts:252` `planPermissionMutationApproval` | The all-or-nothing permission-mutation approval planner. | **KEEP (orthogonal)** — mutation approval is not an I/O ceiling. |

## 2. The live Host wiring of that kernel — **KEEP**, no parallel path

| # | Entry point (path:line) | What it is | Disposition |
|---|---|---|---|
| 19 | `packages/runtime/src/plugin/root.ts:2399` `createControlService({...})` | The one production control-service construction. | **KEEP** — the new adapter is handed this same instance's `guardOperation`. |
| 20 | `packages/runtime/src/plugin/live/agent-bindings.mjs:3307` `controlService.guardOperation` availability check | The live bindings require the real service before a PA approval can be functional. | **KEEP** — reinforces one-authority. |
| 21 | `packages/tools/src/guard.ts:76` `controlService.guardOperation(scope)` | The existing tool-pipeline guard consumer (maps `no-request` → proceed, invariant 34). | **KEEP** — this polarity is exactly why the new adapter cannot inherit `no-request`; it refuses it for `ask`. |
| 22 | `packages/runtime/operation-permission/pre-execute-adapter.ts:897` `installParameterPermissionListener` and `:2130` guard call | The Alpha.4 pre-execute pipeline (`classify → canonicalize → static decision → ask: request → wait → guard`). | **KEEP** — owns requesting/resolving; the new adapter only consumes the resulting durable allow at execution time. |
| 23 | `packages/runtime/operation-permission/pa-control-bridge.ts:309` `createPaControlLeg` | PA ⇄ control bridge (request → await → rung recheck → mint → `guardOperation` consume). | **KEEP / ADAPT(P2+)** — the old effect-set carrier; its `guardOperation` consumption discipline is the reference for the new lane. |
| 24 | `packages/runtime/src/plugin/live/approval-entry-binder.mjs:49` `createApprovalEntryBinder` | "One approval entry point, no duplicate registration". | **KEEP** — the host-level one-entry mechanism. |
| 25 | `packages/runtime/src/plugin/live/pa-mount-registry.mjs:36/48/57` publish / revoke / resolve | Trusted PA mount lifecycle (never trust a tool name, require ACTIVE binding, old disposer cannot clear a newer mount). | **KEEP** — P2/P3 wiring reuses this, not a new mount table. |

## 3. Duplicate permission computations — named, **RETIRE(P3/P4)**, not deleted here

These compute an allow/ask/deny (or effect-set) answer from a *second* model. The new lane's
ONE I/O computation is `packages/runtime/member-io-policy/src/compile.ts:189`
`compileEffectiveIo` over `MemberPolicy` (`types.ts:84`) ∩ `ToolIoRestriction`
(`types.ts:100`). Keeping the rows below alive is intentional for this package: they still
serve the Alpha.4 operation-approval plane, and deleting them would break BL-11's evidence
chain and the P2 native-call cutover. The plan schedules their retirement in P3/P4.

| # | Entry point (path:line) | Duplicate computation | Retirement owner / condition |
|---|---|---|---|
| 26 | `packages/runtime/effective-policy/permission-assembler.ts:479` `assembleEffectivePermissionPolicy` + `:537` `resolveEffectiveOperationPermission` + `:607` `assembleEffectivePermission` | Blueprint / template / overlay → `EffectivePermissionPolicy` → per-operation decision. A second policy-assembly pipeline. | P3/P4; retire when the native `tools.guard` + P1 compiler cover every managed call (reclamation R1-e: mechanism only — revision identity + generation comparison). |
| 27 | `packages/runtime/tool-admission/admission-kernel.ts:222` `createAdmissionKernel`, `:1145` `createProductionAdmissionAssembly`, `:818` `deriveTeamPolicyAuthority` | Unified operation admission over `RequestedEffectSet` + one-shot grant; a second admission algebra beside the Control guard. | P3/P4 (reclamation R1-b: keep single-use/generation mechanism, drop `RequestedEffectSet`). |
| 28 | `packages/runtime/tool-admission/approval-case.ts:245` `planEffectSetApproval`, `:179` `evaluateEffectSetExpansion`, `:446` `verifyEffectSetApproval`, `:81` `effectApprovalScope` | Effect-set approval planning over the retired `RequestedEffectSet` model. | P3/P4; explicitly not re-introduced by this package (plan §0.4 / reclamation §4 anti-pattern). |
| 29 | `packages/runtime/operation-permission/permission-resolver.ts:231` `resolveOperationPermission` | A pure static resolver over canonical rules; a second allow/ask/deny decision function. | P3/P4; retained for the Alpha.4 pre-execute ask path until the native pipeline cutover. |
| 30 | `packages/runtime/tool-admission/grant-mint.ts:74` `mintOperationGrant` + `:111` `createGrantLedger` | A second one-shot grant + consumption ledger beside the durable Control allow. | ADAPT/RETIRE P2–P4 (reclamation R1-b). This package **does not import it**: one-shot is proven through `guardOperation`'s durable `control-allow-consumed`. |
| 31 | `packages/runtime/effective-policy/permission-assembler.ts:10-13` (header diagram) and `packages/runtime/permission-lifecycle/types.ts:36` | The documented "assemble effective policy → resolve operation" lane. | Reference only; retirement tracked with #26. |

### 3.1 What is *not* a duplicate (do not retire by mistake)

- `packages/runtime/operation-permission/approval-routing.ts:338` `routeOperationApproval`,
  `:550` `recheckOperationApproval`, `:609` `recheckPersistedOperationAuthority` — routing
  *which rung must sign* and re-checking a persisted authority point. This is approval-ladder
  knowledge, not an I/O permission computation; the new lane must **not** re-implement it.
- `packages/runtime/operation-permission/canonical-operation.ts` — computes the exact
  operation fingerprint/resource key that a `ControlOperationScope` carries. Scope identity,
  not permission.
- `packages/runtime/tool-dispatch/closed-world-guard.ts:357` `createGovernedSurface` — tool
  surface closed-world guard; identity/registration, not I/O lanes.

## 4. The P1 lane this package builds on (context, not duplicated)

| Entry point (path:line) | Role |
|---|---|
| `packages/runtime/member-io-policy/src/compile.ts:100` `compileMemberPolicy` | LEFT factor: trusted Member identity + bound blueprint + Alpha.4 authority → `MemberPolicy` (generation, revision, read/write/network lanes). |
| `packages/runtime/member-io-policy/src/compile.ts:189` `compileEffectiveIo` | **THE one permission computation**: `EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction`; refuses stale revision / mismatched invocation / tool network unsupported. |
| `packages/runtime/member-io-policy/src/path-rules.ts:115` `matchLocator` | Authored-locator disposition `deny > ask > (allow | all)` — the adapter's disposition source. |
| `packages/runtime/member-io-policy/src/invocation.ts:379` `toInvocationAuthority` | P1-04 audit projection the compiler consumes; single-use capability already proven in `a5sf-invocation.test.ts`. |
| `packages/runtime/member-io-policy/src/trust-registry.ts:85` `createTrustRegistry` | Tool identity + load generation; not a grant. |
| `packages/runtime/team-services/src/install.ts:96` `MEMBER_POLICY_STALE` | The existing stale-generation install refusal the adapter reuses verbatim. |
| `packages/runtime/team-services/src/fs.ts:82` `createMemberFsGuard` | The per-call provider guard that consumes the `EffectiveIoPolicy` this adapter returns (via `installToolBindingRealm`, `install.ts:260`). |

## 5. The seam chosen (public API, CORE PATCH BUDGET = 0)

```
new lane (P1-02 compiled EffectiveIo)
        │  "this locator is `ask`"
        ▼
member-io-policy/src/approval-takeover.ts  ──  resolveAskClassCall(...)
        │   (1) generation check → MEMBER_POLICY_STALE
        │   (2) compileEffectiveIo(...)  ← THE only permission computation
        │   (3) matchLocator(compiled lane)  → deny = refuse, allow = refuse, ask = continue
        │   (4) exact authored ask locator + TeamSession root + exact ControlOperationScope binding
        ▼
ControlService.guardOperation(scope)  ← the SAME public last-mile guard the tool pipeline uses
        │   durable allow + external hard recheck + check-and-reserve consumption
        ▼
ControlGuardVerdict  → allowed ⇒ exactly one ask→allow move on the COMPILED policy
                       denied  ⇒ typed refusal (allow-consumed → APPROVAL_ALREADY_CONSUMED)
```

- **Public surface used:** `@dsh-agent-team/runtime/control` barrel (`control/index.ts:203`,
  `:154-196`) — `ControlService.guardOperation`, `ControlGuardVerdict`,
  `ControlOperationScope`. The adapter imports those types **type-only from the barrel**
  (`from '../../control/index.js'`, never `control/types.js`). No `src/plugin/**` private
  import, no upstream package touched.
- **TeamSession binding:** the caller must pass the required `expectedRootSessionId`; the
  adapter refuses when it is absent/blank or when `scope.rootSessionId` differs, because an
  instance id is unique only within a team.
- **Why it is the only approval authority:** `guardOperation` is the same function that
  performs the durable `control-allow-consumed` check-and-reserve under the per-team lock
  (`control/service.ts:3240`); the new adapter owns **no state, no ledger, no grant table**.
  A second consumption therefore has to reach the same durable row and is refused by it —
  proven by `a5sf-approval-takeover.test.ts` against a real `ControlService` over the
  P6-T4 durable unit world, not only against a test double.
- **Why no second compiler:** `resolveAskClassCall` takes the already-compiled
  `MemberPolicy` + `ToolIoRestriction` + `InvocationAuthority`. It has no blueprint, overlay,
  authoring-map or server input. `a5sf-approval-takeover.test.ts` pins this with a fabricated
  compiled lane that a blueprint-reading compiler could not produce, plus a source fence that
  fails if `compileMemberPolicy` / `vnext-field-mapping` / `findMemberIoCeiling` ever enters
  the adapter.

## 6. Blocker status

**None.** The seam was already public and frozen; no `CORE_SEAM_BLOCKER` arose. The real
Control→Binder Host round-trip is **not** attempted here (it needs a Host boot and is P2 work).
