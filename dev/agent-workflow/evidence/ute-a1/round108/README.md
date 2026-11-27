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
| `packages/runtime/test/t12a-m3-recursive-drain.test.ts` | **M3-6**: a double exposing ONLY the rc.5 name drives the same drain + honest count (`:171`). **M3-7**: a service with `listDescendants` but neither public drain name still refuses typed (`:181`). 7/7 tests pass. |
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

## 6. Gates at `acc72e58e` (logs in this directory)

| gate | verdict |
| --- | --- |
| `candidate-acceptance-gate --hosts next` | **`CANDIDATE-GATE pass host=next judges=31 proven=30 known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true`** — the only non-PROVEN id is the enumerated `d4:ask-execute-process`; machine verdict `dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T16-32-03-294Z/verdict.json` (head `acc72e58e`) |
| `dispatch-tests --run --leg ute-vnext-a1` | `tests=251 pass=248 fail=0 skipped=3`, `set=sha256:edd4f1c4…` (**unchanged**: the two new arms live in a file already in the root vitest population, not in this leg) — `ute-leg.log` |
| `test-catalog --max-uncollected 41 --max-excluded 7` | `tests=785` collected 733 excluded 14 **uncollected 38** `refused=0 findings=0`, digest `sha256:da8a452d…` — **no new scannable file**, so the catalog population is unchanged by construction |
| `ute-cut-closure --check` | `pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 findings=0` |
| `ute-p0-assets --check` | `pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 cut=cut(148/148) findings=0` |
| `docs-sync --check` | `docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20` (authority pointer digest verified) |
| `place-dist-glue` | `done (35 placement(s))`, every line byte-identical |
| `eb3-ci-required` | `pass workflows=11 findings=0` |
| bound vitest leg `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt` | `verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0` — `ci-integration.log` |
| UTE G1 nine-file argv (`node --test --test-force-exit --test-timeout=480000 --test-reporter=spec` over `tests/ute1-fs/native-fs-binding.test.mjs` + the six `lane-suite.test.mjs` + `refusal-categories` + `product-route-image`) | `tests 89 pass 89 fail 0 skipped 0` — `ute-g1-argv.log` |
| `ute-a1-window --check` | `pass branch=vnext/a1-cut red=0/0 cut=(148/52) findings=0` |
| `eb3-run-manifest` | `pass records=552 strict=0 incomplete=11 findings=0` — `eb3-run-manifest.log` |
| `ci-pr-gate --full --census-captures 2` | **`DSH-CI-VERDICT pass pass=10 fail=0 skip=0 legs=10 refused=0`** (321.3 s; census `599f/7424l`, two captures with **identical identity sets**) — `ci-pr-gate-full.log` |

**One disclosed flake, not hidden.** The first `ci-pr-gate --full` attempt (same argv, head `acc72e58e`)
went red on the census leg: `packages/runtime/test/u6-mcp-017-regression.test.ts` failed **only in
capture 1** with `ERA_NEGOTIATION_FAILED` → `fetch failed` → `ConnectTimeoutError` to the test's own
`127.0.0.1:3985` (10 s), while capture 2 passed; the two captures' identity sets therefore differed,
and the leg grades their union. That test then passed alone in 77 ms, no listener or stray process
existed on that port, and the **re-run with identical argv was PASS 10/10**. Both facts are stated
here; the red attempt's own comparison artifact is
`dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/census-comparison-20261124T170032Z-3.json`.
Nothing in this round touches MCP discovery; the failure is a loopback connect timeout under the
two-capture load. No gate was weakened, no timeout widened, no judge skipped.

**Population delta: zero new scannable files.** No `packages/**` source file was added, no test file
was added or removed, and no dispatch leg changed. The round-108 change adds two `it` arms inside the
already-collected `packages/runtime/test/t12a-m3-recursive-drain.test.ts` (so `tests=785` and the
catalog digest are unchanged) and edits the existing driver + bridge double. `place-dist-glue`
re-placed the 35 `.mjs` glue files byte-identically after the `tsc` rebuild.

### Post-commit re-run of the cheap gates (`603ab8f4f`, logs `*-postcommit.log`)

The six documentation-sensitive gates were re-run **after** the round-108 docs/evidence commit, so
their verdicts describe the head that carries the prose (same values as §6):

```
docs-sync --check          docs=193 findings=0 blocking=0 contracts=20
test-catalog                tests=785 digest=sha256:da8a452d… refused=0 findings=0
ute-cut-closure --check     pass cut(0/148) deleted=148 prodRefs=0 distResiduals=0
ute-p0-assets --check       pass 37 modules / 180 files / 69512 lines cut(148/148)
place-dist-glue             done (35 placement(s)), byte-identical
ute-a1-window --check       pass red=0/0 cut=(148/52)
```
