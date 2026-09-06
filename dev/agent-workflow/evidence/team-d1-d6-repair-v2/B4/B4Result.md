# B4 — D5 regression confirmation: deterministic provider-owned instanceId contract (v2)

## TaskResult

- **task**: B4 (Wave B, TEAM_D1-D6_REPAIR_PLAN_V2 §8/B4)
- **attempt**: 1
- **elapsed**: 10 minutes (start 2026-09-07T01:16:20+08:00, worktree 01:16:48, commit 01:25:3x)
- **base sha**: `0b968d7cd8c913ee7eb8cf714f0640f8ddcbbba4` (master)
- **head sha**: this commit (branch `task/team-d1-d6-v2-B4`, worktree `.worktrees/team-d1-d6-v2-B4`)
- **model route verification**: runtime declaration states model `qwen3.8-27b`; host config `C:\Users\user\.dsh\settings.yaml` has `agent-default-model: provider qiyuan-self / model qwen3.8-27b` and model `qwen3.8-27b` is offered exclusively by provider `qiyuan-self` → full route `qiyuan-self/qwen3.8-27b` — **verified OK**
- **changed files**:
  - `packages/runtime/test/d5-instance-contract.test.ts` (owned file; extensions only — existing 5 tests byte-identical, +139/−1 lines: the −1 is the widened import line)
  - `dev/agent-workflow/evidence/team-d1-d6-repair-v2/B4/B4Result.md` (this file)
- **product code**: **UNCHANGED** — allocation algorithm (`packages/runtime/activation/identity.ts`), provider, checks, tools, contracts: zero modifications. `git status --porcelain` showed only the owned test file (+ untracked transcripts, deleted before commit). `git diff --check` — exit 0.
- **verdict**: **PASS**
- **blocker**: none
- **stop conditions not hit**: no allocation bug discovered (the one mid-run test failure was my own arithmetic in a NEW assertion — `inst-` = 5 chars, 5+12 = 17, I had written 15 — fixed in the test, product code never touched; see §5)

## 1. Requirement 1 — existing file baseline: 5/5 PASS

Command (in worktree, after `pnpm install --ignore-scripts`, 2m26s, exit 0):

```
pnpm exec vitest run packages/runtime/test/d5-instance-contract.test.ts
```

Transcript (01:20:50, before any edit):

```
RUN  v4.1.11 D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/team-d1-d6-v2-B4

 ✓ packages/runtime/test/d5-instance-contract.test.ts (5 tests) 6ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  01:20:50
   Duration  7.41s (transform 3.37s, setup 0ms, import 3.52s, tests 6ms, environment 0ms)
```

## 2. Coverage assessment (v1 5 tests vs B4 required assertions a–d)

Allocation under test: `allocateActivationInstanceId(rootSessionId, source, requestToken)` /
`activationOperationIdentity(...)` — `packages/runtime/activation/identity.ts` (key
`root\u0000source\u0000token`, id = `inst-` + `deterministicToken(key, 12)`, explicit
`LEADER_INSTANCE_ID` collision guard throwing `ACTIVATION_LEADER_INSTANCE_RESERVED`).

| Req | v1 coverage | Gap found | B4 addition |
|---|---|---|---|
| (a) caller-controlled `instanceId` rejected / no effect | test 5: `team_create_member` schema — no `instanceId` property, `additionalProperties: false` | no behavior-level proof that a call carrying `instanceId` constructs a request WITHOUT it | new test: execute the real tool with a spy `teamRuntime.performAction` + `instanceId: 'inst-evil000000'` in args → assert captured `TeamRuntimeActionRequest` has no own `instanceId` (top-level or payload), its JSON never contains the caller value, and the provider-owned allocation for the same (root, source, token) is not steered by it |
| (b) two parallel same-template creates → distinct deterministic ids | tests 2+3: distinct tokens → distinct ids; 3 parallel same-source → 3 distinct | no explicit DETERMINISM assertion (same token re-allocated → same id); no cross-source key-collapse guard | new test: two parallel same-source creates distinct; each re-allocation converges to the identical id; same token under a different source (different logical op) must not collide |
| (c) `inst-leader` reserved, never allocated to a member | test 4: single allocation ≠ leader id; constant = 'inst-leader' | single-point check only; no key-space sweep; no well-formedness assertion | new test: 3 sources × 64 tokens + 2 extra roots × 3 sources = 198 allocations; none equals `LEADER_INSTANCE_ID`; every id matches contracts `INSTANCE_ID_PATTERN` (`/^inst-[a-z0-9]{1,32}$/`) and has length 17 (`inst-` + 12 base36) |
| (d) same-`requestToken` replay converges, no second allocation | test 1: operation identity (instanceId+operationId+idempotencyKey) equal across calls | no direct determinism assertion on `allocateActivationInstanceId` itself; identity not tied to the direct allocation | new test: same-token re-allocation identical; identity triple invariant across replay (the journal convergence inputs, so the provider re-drives the existing durable op instead of allocating a second instance — the durable admit-once re-drive is exercised end-to-end by the existing P6-T1 recovery tests R1/R5, `p6t1-recovery.test.ts`, in the green run below); a different token allocates a second instance (no over-convergence) |

No change to the allocation algorithm was needed or made.

## 3. TDD red phase (new assertions proven non-vacuous)

A temporary scratch file `packages/runtime/test/zz-d5-b4-mutation-redcheck.test.ts` (NEVER committed;
deleted before commit) ran the new assertions verbatim against three deliberately BROKEN local
allocations (counter-based non-deterministic; key collapsed over (root, token) dropping source;
leader-colliding). Transcript (01:23:08, exit code 1):

```
 ❯ packages/runtime/test/zz-d5-b4-mutation-redcheck.test.ts (3 tests | 3 failed) 8ms

 FAIL  ... > RED: (b) determinism assertion fails on the non-deterministic allocation
AssertionError: expected 'inst-000000000002' to be 'inst-000000000001' // Object.is equality

 FAIL  ... > RED: (b) cross-source distinctness fails on the key-collapsed allocation
AssertionError: expected 'inst-0000007b8shj' not to be 'inst-0000007b8shj' // Object.is equality

 FAIL  ... > RED: (c) leader-reservation sweep fails on the leader-colliding allocation
AssertionError: expected 'inst-leader' not to be 'inst-leader' // Object.is equality

 Test Files  1 failed (1)
      Tests  3 failed (3)
```

All three new assertion groups FAIL against broken allocations → the assertions catch
non-determinism, key collapse, and leader collision. (No product-code mutation was used; the
scratch file defined the broken functions locally.)

## 4. TDD green phase — extended file against the real, unchanged product code

```
pnpm exec vitest run packages/runtime/test/d5-instance-contract.test.ts
```

Transcript (01:24:31, after the §5 test-side fix):

```
RUN  v4.1.11 D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/team-d1-d6-v2-B4

 ✓ packages/runtime/test/d5-instance-contract.test.ts (9 tests) 11ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  01:24:31
   Duration  589ms (transform 357ms, setup 0ms, import 468ms, tests 11ms, environment 0ms)
```

**9/9 PASS** = the five v1 tests unchanged + four new B4 assertions (a)/(b)/(c)/(d).

## 5. Mid-run note (honest record): one transient failure, TEST-side only

The first green run (01:23:12) reported `1 failed | 8 passed (9)`: the new (c) sweep asserted
`id.length === 15`. The allocation is correct — `inst-` is 5 characters and `deterministicToken`
returns exactly 12 (`identity.ts:74-85`), so ids are 17 chars; the v1 T5 test only ever compared
against the leader constant and never fixed the length. This was an arithmetic error in MY new
assertion (15 instead of 17), not an allocation bug: the swept ids were all well-formed, distinct
from `inst-leader`, and pattern-valid. Fixed the test assertion to `17`; no product code touched.
The subsequent run is the §4 green transcript.

## 6. Supplemental signals (same worktree, same install)

- **Full runtime package suite** (includes the extended file, the P6-T1 activation/recovery
  regression, and every other runtime test):

  ```
  pnpm exec vitest run packages/runtime/test
  → Test Files  127 passed (127)
            Tests  1172 passed (1172)
            Duration  19.37s (01:23:40, exit 0)
  ```

- **Team-owned typecheck** (G2 check list): `pnpm --filter @dsh-agent-team/runtime typecheck`
  → exit 0 (after one test-side strictness fix: `captured[0]` narrowed for
  `noUncheckedIndexedAccess`). No product-code type errors introduced.
- **`git diff --check`** → exit 0.
- **Host instances**: none started in this wave (per task instruction — host smokes happen at the
  gate). `:3080` untouched; `D:\deepseek-harness` untouched; `references/` untouched.
  `references/deepseek-harness-test-use` not used by this task (pure unit-level contract tests).

## 7. Remaining risks (non-blocking, for G2)

- The (d) "no second allocation" property is confirmed at the IDENTITY level here (stable
  operationId/idempotencyKey across replay) plus the existing P6-T1 R1/R5 durable re-drive tests in
  the 1172-test green run; a dedicated D5-branded provider-level replay test was NOT added to keep
  this task inside its owned file (adding the P6-T1 world fixture to the D5 file would couple two
  test suites — flagged for a future task if G2 wants it).
- The (a) "rejected" half is enforced by the host pipeline's JSON-schema gate
  (`additionalProperties: false`); the new tool-layer test proves "does not take effect" at the
  tool→runtime boundary. A caller bypassing BOTH layers (hand-rolled `TeamRuntimeActionRequest`
  with an extra field) is not rejected by `validateActionRequest`'s current field-wise checks —
  but such a request cannot steer the allocation either (instanceId is derived solely from
  (root, source, token) inside the provider), so the D5 invariant holds regardless. Recorded as a
  hardening observation, not a contract gap.
- The (c) sweep is finite (198 key-space samples); the structural guarantee is the length
  mismatch (`inst-leader` is 11 chars vs allocated 17) plus the loud
  `ACTIVATION_LEADER_INSTANCE_RESERVED` guard in `identity.ts:114-120`.
