# Z. R1 (BL-09) — approval & governance takeover, evidence README

> **Dated 2026-11-02 (real UTC).** Alpha.5 Sandbox-First work package **R1 = BL-09**.
> Branch `task/a5sf-r1-approval-20261102`, git worktree `.worktrees/a5sf-r1-approval`,
> based on `origin/master` @ `17ce7043089980fe1a2e56b29be12459bc74fc9f`.
> CORE PATCH BUDGET = 0: nothing under `tests/deepseek-harness-test-use/` or any upstream tree
> was read/written; no `RequestedEffectSet`, no `FamilyAssembly`, no second policy compiler and
> no second approval store was introduced.

## 1. The law this package enforces

```
EffectiveIo(member, tool, call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member, tool)
```

There is exactly **one permission computation** (`member-io-policy/src/compile.ts:189`
`compileEffectiveIo`) and exactly **one approval authority** (`control/service.ts:3240`
`ControlService.guardOperation`, the durable last-mile guard). The new adapter
(`member-io-policy/src/approval-takeover.ts`) only lets an existing Alpha.4 approval select
**one authored `ask` locator** out of the already-compiled intersection for **one call**. It can
never raise the hard ceiling and it owns no replayable state.

## 2. What was inherited (not rebuilt)

| Inherited asset | Source of truth | How R1 uses it |
|---|---|---|
| Durable approval case + decision | `packages/runtime/control/service.ts:1651` `createControlService`, `:2141` `requestControl`, `:2555` `resolveControl`, `:5031` `readApprovalCaseState` | Not re-implemented; the adapter never requests/decides. |
| Last-mile guard + exactly-once consumption | `packages/runtime/control/service.ts:3240` `guardOperation` (durable `control-allow-consumed` under the per-team lock) | **The chosen seam.** Consumed as `AskApprovalAuthority`; replay is refused by the existing durable row. |
| Approval-case-shaped decision types | `packages/runtime/control/types.ts:1502` `ControlOperationScope`, `:1923` `ControlGuardVerdict`, `:1818` `CONTROL_GUARD_BLOCK_REASONS` | Imported by type only; the adapter maps the closed reasons (`allow-consumed` → `APPROVAL_ALREADY_CONSUMED`, everything else non-allow → `APPROVAL_DENIED`). |
| Public barrel | `packages/runtime/control/index.ts:203` | No private/upstream import; the seam was already public. |
| Stale-generation semantics | `packages/runtime/team-services/src/install.ts:96` `MEMBER_POLICY_STALE` | Reused verbatim for a policy compiled at generation N used by an instance at N+1. |
| One I/O compiler | `packages/runtime/member-io-policy/src/compile.ts:100/189` | The adapter consumes `MemberPolicy` + `ToolIoRestriction` + `InvocationAuthority`; it never re-reads a blueprint/overlay/authoring map. |
| One-shot invocation capability | `packages/runtime/member-io-policy/src/invocation.ts:379` (P1-04, already tested) | Untouched; the approval one-shot is a separate, durable Control fact. |
| Per-Member provider enforcement | `packages/runtime/team-services/src/fs.ts:82` `createMemberFsGuard`, `install.ts:260` `installToolBindingRealm` | The narrowed `EffectiveIoPolicy` is shaped for these consumers; mounting is P2. |

The full inventory (every entry point, disposition, and the duplicate permission computations
P3/P4 must retire) is [`INVENTORY.md`](./INVENTORY.md).

## 3. What was adapted (the only new production code)

`packages/runtime/member-io-policy/src/approval-takeover.ts` — `resolveAskClassCall(input)`:

1. **Generation gate** — `memberPolicy.instanceGeneration` vs the caller-supplied trusted
   generation → `MEMBER_POLICY_STALE` (existing semantics).
2. **The one compiler** — `compileEffectiveIo(memberPolicy, tool, invocation)`; its refusals
   (e.g. `STALE_POLICY_REVISION`, `INVOCATION_MISMATCH`) pass through unchanged.
3. **Disposition** — `matchLocator(compiledLane, locator)`:
   - `deny` → `APPROVAL_CANNOT_WIDEN` **before** the authority is consulted;
   - `allow` → `APPROVAL_NOT_ASKED` (no approval path);
   - `ask` → continue.
4. **Binding** — the asked locator must be an **authored** `ask` locator (not a child of an ask
   subtree), the scope must name the same member, the same tool and the same correlation, and
   when the scope carries a canonical `operationFingerprint` the ask must carry the **same**
   fingerprint (the adapter compares strings; it never derives a fingerprint — that would be a
   second canonicalizer).
5. **Existing authority** — `await approvalAuthority(scope)`; thrown/unavailable → fail closed
   `APPROVAL_AUTHORITY_FAILED`; `allow-consumed` → `APPROVAL_ALREADY_CONSUMED`; any other
   non-allow → `APPROVAL_DENIED` (notably `no-request`, which the tool guard treats as
   leader-autonomy, is **never** an implicit allow for an `ask`).
6. **Narrow** — exactly one `ask → allow` move on the **compiled** policy; every other locator,
   lane, revision and identity is copied verbatim and frozen.

The adapter has **no state**: no map, no ledger, no grant table, no epoch. One-shot is enforced
by the durable Control row, not by the new lane.

## 4. RED → GREEN (real command output, not hand-written)

### RED (captured before the adapter existed)

```
cd packages/runtime
../../node_modules/.bin/vitest run test/a5sf-approval-takeover.test.ts
```

Result: `1 failed`, `0 test`, exit code 1 —
`Error: Cannot find module '../member-io-policy/src/approval-takeover.js'`.
Full output: [`red-test.log`](./red-test.log).

### GREEN (all existing a5sf suites + the new suite)

```
node_modules/.bin/vitest run a5sf
```

Result: **11 files, 157 tests passed** (140 pre-existing + 17 new) — full output in
[`green-tests.log`](./green-tests.log). The 140 baseline is the G1 inventory
(`evidence/a5sf-g1/g1-full-run.log`): 9 `packages/runtime/test/a5sf-*` files (119) plus
`packages/domain/test/a5sf-v4-member-ceiling-projection.test.ts` (21).

### Typecheck

```
node_modules/.bin/tsc -p packages/runtime/tsconfig.json   # exit 0, no output
```

`packages/domain` was not touched (no change, no re-run needed for this lane; the domain
projection suite is part of the GREEN run above).

### Source-scan ledger (p4t6) — required because the lane adds two scannable paths

```
node_modules/.bin/vitest run packages/testkit/test/p4t6-session-event-scan.test.ts
```

Before booking: `scanner counts 1425, ledger derives 983 + 440 = 1423` (the two new files).
After adding `approval-takeover.ts` + `a5sf-approval-takeover.test.ts` to
`packages/testkit/test/p4t6-bookings/a5sf.json` and moving its measured tie from
`{from: 1396, to: 1423}` to `{from: 1396, to: 1425}`: **20/20 passed**. No denylist vocabulary
was added (the frozen quarantine hit set is unchanged).

### New tests (17) — `packages/runtime/test/a5sf-approval-takeover.test.ts`

| Law | Legs |
|---|---|
| approval cannot widen | explicit deny stays denied; locator outside every allow stays denied; the authority is never even called |
| approval can narrow | exactly the asked authored `ask` locator becomes allow; a different ask locator still asks; out-of-lane locators still deny; write axis untouched |
| named limit | a child under an ask subtree is refused (`APPROVAL_SCOPE_UNBOUND`) instead of widening the subtree |
| one-shot not replayable | pure double leg **and** a real `ControlService` over the durable P6-T4 unit world: first allow consumed, replay `APPROVAL_ALREADY_CONSUMED`, exactly one `control-allow-consumed` row |
| stale generation | `MEMBER_POLICY_STALE` (generation N vs N+1); `STALE_POLICY_REVISION` from the single compiler |
| exact scope | member / tool / correlation / resource-fingerprint mismatches refused before the guard |
| fail closed | denied / pending / **no-request** verdicts → `APPROVAL_DENIED`; a throwing authority → `APPROVAL_AUTHORITY_FAILED` |
| one computation | output equals `compileEffectiveIo` + one ask→allow move; a fabricated ask lane that exists only in the policy object still resolves; source fence forbids `compileMemberPolicy` / `vnext-field-mapping` / `findMemberIoCeiling` / any grant ledger in the adapter |

## 5. What remains for P2 (deliberately NOT performed here)

1. **The real Control → Binder → Provider round-trip on a live Host** — a Host boot, the
   native `tools/pre-execute` pipeline, `requestControl`/`resolveControl` through the real
   service wiring (`src/plugin/root.ts:2399`), the pa-control bridge, and the durable evidence
   chain (`member → definition → callId → revision → approval → provider/OS → effect`). This
   package proves the adapter + the real ControlService in a durable *unit* world; it does
   **not** claim a live-Host round-trip.
2. **Wiring the returned narrowed `EffectiveIoPolicy` into the execution path** — the P2 native
   tool dispatch must mount/guard with the narrowed policy for that one call (P1-05's
   `installToolBindingRealm` / `createMemberFsGuard` are the consumers). No Host/provider
   registration was changed here.
3. **Requesting / resolving the approval from the new lane** — that stays the Alpha.4
   pre-execute pipeline's job (`operation-permission/pre-execute-adapter.ts:897`); the new
   lane only consumes an already-decided durable allow.
4. **Duplicate-computation retirement** — the P3/P4 owner removes the second admission/policy
   pipelines named in `INVENTORY.md` §3. They are still live for Alpha.4 operation approval;
   deleting them in R1 would break BL-11's evidence chain.
5. **Persistent-process / revocation interaction** (BL-30 / P4-04): a long-lived process that
   outlives its one-shot approval is a P4 concern; this adapter resolves one call.

## 6. Residual risks / named limits (honest disclosure)

1. **Ask granularity is the authored locator.** An approval for a child of an authored ask
   locator is refused (`APPROVAL_SCOPE_UNBOUND`). Permitting it would either widen the whole
   ask subtree or require a per-call exception lane the provider algebra does not have. This is
   a deliberate named limit, not a silent workaround.
2. **No network `ask` lane.** Network is a boolean this round
   (`member-io-policy/types.ts:26`); the compiler refuses destination-restricted network lanes.
   The adapter therefore only narrows `read`/`write`.
3. **Resource binding for legacy scopes.** When `ControlOperationScope.operationFingerprint` is
   absent (a legacy/pre-exact-scope row), the adapter cannot compare the asked resource to the
   approval's fingerprint. It still cannot widen the compiled ceiling, but it relies on the
   caller supplying the exact scope the human approved. Production callers must pass the
   canonical scope (with `operationFingerprint`) and the matching ask fingerprint; the
   integration leg proves that path.
4. **Generation truth is caller-supplied.** `currentInstanceGeneration` must come from the
   TeamDomain, never from model input. The policy revision also embeds the generation
   (`compile.ts` revision material), so a stale-gen invocation normally fails
   `STALE_POLICY_REVISION` as well; the explicit generation gate is the second, earlier check.
5. **The durable approval is not generation-tagged in this seam.** If the approval was recorded
   before a generation bump, the adapter refuses on the policy generation but does not inspect
   the approval's age. The Control plane's own authority re-check (`authority-risen` /
   `authority-undetermined`, zero consumption) remains the guard for that drift; a future P2
   chain should assert both facts on the same call.
6. **The integration test is a durable unit world, not a Host boot.** Running a real
   `ControlService` over the P6-T4 world is stronger than a fake, but it does not exercise the
   production construction (`root.ts`), the live external-policy facts port, the Host boot
   budget, or the native tool pipeline. No claim beyond that is made.

## 7. Evidence index

| File | Content |
|---|---|
| [`INVENTORY.md`](./INVENTORY.md) | every approval/grant/control entry point with `file:line`, disposition, duplicate computations, chosen seam |
| [`red-test.log`](./red-test.log) | real vitest output of the failing pre-implementation run |
| [`green-tests.log`](./green-tests.log) | real vitest output: 11 files / 157 tests green |
| `packages/runtime/test/a5sf-approval-takeover.test.ts` | the 17 new tests |
| `packages/runtime/member-io-policy/src/approval-takeover.ts` | the adapter |
| `packages/runtime/member-io-policy/src/index.ts` | public export of the adapter |
| `packages/testkit/test/p4t6-bookings/a5sf.json` | books the two new scannable paths (measured tie `1396 → 1425`) |
