# Round 108 — the two rc.5 gaps re-run; the `d2:remote-delivery` rc.5 refutation was a PRODUCT defect

**Dated**: 2026-11-24 (real UTC) · branch `vnext/a1-cut` · PR #822 (DRAFT, unmerged) · worktree
`.worktrees/vnext-a1-cut` only · `:3080` and its DSH_HOME untouched · no other worktree touched.

**Scope of the round (review `20261124-2120` §3, first P0).** The round-106 single acceptance table
still carried two rc.5 gaps: `d:remote-creation` (not re-run on rc.5 since the round-91 judge repair)
and `d2:remote-delivery` (no rc.5 verdict recorded, and the round-105 candidate gate had MEASURED a
rc.5 refutation: clause `archived-member-refused-typed` failed on both boots with
`lifecycle=SETTLED code=null requestsAdded=0`). This round re-runs both, diagnoses the refutation,
fixes the product defect it turned out to be, and restates the single table's rc.5 column.

**Measurement head:** `e30d22c6085b607890aba685ceeb4b7596445108` **plus the round-108 drain-seam arm**
(the child commit carrying this evidence). Host: rc.5 (`TEAM_TEST_HOST=next`,
`tests/deepseek-harness-next` @ `9c2670d3bce5275e0d1610272958121af87787bb` = `dsh-v0.2.2-rc.5`).
Both drivers `--boots 2`; ports leased from the rc.5 band (13000/13057); host-tree porcelain
`[]` before and after; every World home deleted by its own teardown.

## 1. Verdicts

```
d    (rc.5, 2 boots)  RESULT PASS (2/2 boots; agreeing pair=true)
  d:member-read-admitted   PASS PASS   7/7 clauses   d:member-read-denied     PASS PASS  11/11
  d:native-read-surface    PASS PASS   6/6           d:guard-facts            PASS PASS   5/5
  d:centre-facts           PASS PASS   9/9           d:remote-creation        PASS PASS   8/8
  counters (identical both boots): allowFacts=2 denyFacts=0 centreAdmissions=2 centreExecutions=2
                                   governedSurface=true admittedBytes=true deniedSecretAbsent=true

d2   (rc.5, 2 boots)  RESULT PASS (2/2 boots; agreeing pair=true)
  d2:multi-member-concurrency PASS PASS  18/18       d2:revocation            PASS PASS  18/18
  d2:stop                     PASS PASS  11/11       d2:remote-delivery       PASS PASS  20/20
  archived-member-refused-typed (both boots):
    archiveOk=true archiveCode=null archiveMessage=null lifecycle=ARCHIVED
    code=TEAM_RUNTIME_WORK_STATE_REJECTED requestsAdded=0
  agreement rows identical: aAdmissions=10 bAdmissions=10 aGuardFacts=14 bGuardFacts=16
```

Console logs: `d-rc5.log`, `d2-rc5.log`. The pre-fix reproduction of the refutation (kept for the
record) is `d2-rc5-before-fix.log`: `RESULT FAIL (2/2 boots; agreeing pair=true)`, one clause
`archived-member-refused-typed: lifecycle=SETTLED code=null requestsAdded=0`, all other clauses
PROVEN.

## 2. The diagnosis — the product was wrong, the judge was right

1. **The archive reply was its own typed failure.** The round-105 driver kept only
   `archiveOk=false`'s consequence and discarded `result.error`; the durable row read-back
   (`/__p6t6/state`) showed member B still `SETTLED`. Round 108 added `archiveCode`/`archiveMessage`
   to the driver's observation (strictly additive) to make the channel visible.
2. **The `member.send` was correct.** `SETTLED` is one of `WORK_ACCEPTING_STATES`
   (`packages/domain/member/src/context-policy.ts:117`), so an un-archived member lawfully accepts a
   delivery (`ok=true`, `requestsAdded=0` at ack time — the member's own turn starts later). Nothing
   was silently dropped: the archive had never happened.
3. **Root cause = a renamed PUBLIC host seam.** 0.2.2-rc.5 renamed
   `SubagentRuntime.drainContinuableDescendants` (0.2.0-rc.2,
   `tests/deepseek-harness-test-use/packages/subagent/subagent/src/index.ts:342`) to
   `SubagentRuntime.drainDescendants` (`tests/deepseek-harness-next/packages/subagent/subagent/src/index.ts:404`)
   — identical signature (`parents: readonly Agent[]`), identical aggregate-after-all-branches-settle
   contract, and it calls the very same `manager.drainDescendants(parents)` underneath. Both are
   public service methods.
4. The product's drain seam hard-required the rc.2 name
   (`packages/runtime/src/plugin/vnext/stop-drain-lane.mjs`, pre-fix lines 194 and 201), so on rc.5:
   `recursive-drain-unavailable` → `quiesce.ts` maps it to `LIFECYCLE_LIVE_EFFECT_FAILED` at step
   `drain-descendants` → the archive procedure refuses **before any durable write** → the member stays
   `SETTLED`. `member.restore` then also fails (there is nothing archived to restore), which the
   evidence shows as `restoreOk=false`.
5. Therefore the clause's expectation is the correct invariant: **an archived member's delivery is
   refused with a typed code and zero added requests.** It is satisfied once the member can actually
   be archived. The clause was NOT rc.2-shaped; it was never reached on rc.5.

## 3. The fix (arm, no upstream patch — CORE PATCH BUDGET = 0)

| file | change |
| --- | --- |
| `packages/runtime/src/plugin/vnext/stop-drain-lane.mjs` | `resolveDrainSeam` (`:177`) resolves the drain seam by PUBLIC NAME capability — `drainDescendants` (rc.5) first, then `drainContinuableDescendants` (rc.2) — and passes the parents verbatim (`:238`, `:248`); a host exposing neither still fails closed typed (`:241`). One observation records which name the host exposed. |
| `packages/runtime/src/plugin/types.ts` | `SubagentsDrainPort` documents both public names and makes each optional. |
| `packages/runtime/test/t12a-m3-recursive-drain.test.ts` | **M3-6** (bound arm): a double exposing ONLY the rc.5 name drives the same drain + honest count (`:171`). **M3-7**: a service with `listDescendants` but neither public drain name still refuses typed (`:181`). 7/7 tests pass. |
| `packages/runtime/test/t12a-live-bridge.mjs` | the subagents double takes `drainMethodName` so each arm models one host generation's real shape. |
| `tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs` | observation only: records `archiveCode`/`archiveMessage` and the archive reply in the judge detail. **No predicate was relaxed, no judge skipped, no timeout widened, no retry added.** |
| `packages/runtime/dist/**` | rebuilt (`tsc`) + `place-dist-glue` re-placed the 35 `.mjs` files byte-identically. |

## 4. Positive control (required before any observation change — and none was made)

On the SAME rc.5 boots, the same `member.send` channel is **accepted** for a live member
(`member.send ack: status=200 ok=true ... deliveredSeq=40`) and again for the RESTORED member
(`restore-reenables-delivery` PROVEN; `restored.lifecycle=SETTLED ok=true`). The channel is not
blanket-refusing; it refuses exactly the ARCHIVED target, with the typed code
`TEAM_RUNTIME_WORK_STATE_REJECTED`. The clause predicate only grew observability (`archiveOk` /
`archiveCode` in the detail), never a weaker `ok`.

## 5. What did not change

- rc.2 verdicts are byte-identical (no rc.2 run this round; no historical evidence was edited).
- `KNOWN_REFUTED` still contains exactly one literal id (`d4:ask-execute-process`); nothing was added.
- No row moves to PRODUCT-PROVEN; both rows stay DEV-LIVE (the gate is non-required).
- PR #822 stays DRAFT; no merge, no history rewrite, no non-topic push.
