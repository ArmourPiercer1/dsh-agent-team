# P7-T2 Brief — Runtime mutation/provenance (task/P7-T2-runtime-mutation)

> Kickoff round R47. Single worker, dispatched via workflow, provider `qiyuan-self`, model `qwen3.8-27b`.
> This brief is authoritative for the worker. The worker does NOT see main-agent conversation context.

## §0 MANDATORY FIRST STEP (prompt-injection rule, no exceptions)

Before touching anything, read in the worktree:

1. `docs/ROUTER_RULES.md` — unattended execution protocol, blocker types/formats, git discipline.
2. `docs/TEST_METHODS.md` — test-infrastructure constraints, sanctioned command chain.

Do not claim familiarity; read both. Any conflict: frozen docs > ROUTER_RULES > TEST_METHODS > this brief.

## §1 Task card (TaskDoc §11.8, L1595–1608, verbatim)

### P7-T2 — Runtime mutation/provenance

- **目标**：实现 model/tool/permission/skill/MCP future-boundary mutation、PolicyState、Autonomy Overlay、Human Override provenance。
- **拥有的文件/包**：`packages/runtime/mutation*；policy adapters`
- **前置依赖**：P6-T6,P7-T1
- **允许依赖**：policy + binder adapters
- **禁止项**：全局 forbidden block。
- **实现要点**：workspace/context creation fields 不允许创建后非法变更。
- **必须测试**：all mutation boundaries；suppressed override；human vs leader；external hard。
- **验收标准**：Effective Configuration 每项有来源，非法 escalation 被拒。
- **输出物**：mutation module；provenance tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`H2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

## §2 Frozen-document anchors (read-only; verify hashes)

- `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md` — sha256 `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53`
- `docs/plans/active/DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md` — sha256 `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e`
- `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md` — sha256 `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f`
- `docs/plans/active/DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md` — sha256 `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3`

Semantics to implement per DevPlan:
- **20.2 Runtime mutation** (the governing section): model future step; permission/tool future operation; skills/MCP future operation; human override; Autonomy Overlay; PolicyState suppression/provenance. **所有 effective config 都必须可解释 provenance** (every effective configuration item must carry explainable provenance).
- **15 Characterization Matrix** seam rows for failure codes if a capability cannot be expressed on public seams: `MODEL_SELECTION` (future request-boundary mutation takes effect; in-flight unchanged), `TOOLS_SCOPE`, `SKILL_SCOPE`, `MCP_SCOPE`.

## §3 Work environment & single-writer rule

- Repo: `D:\AgentDev\dsh-plugins\dsh-agent-team` (main worktree is on `master` — do NOT work there for code).
- Create your worktree exactly:

  ```
  git -C D:\AgentDev\dsh-plugins\dsh-agent-team worktree add .worktrees/P7-T2 -b task/P7-T2-runtime-mutation 3aa146c801ed7509cc23c1b414665de5a5363180
  ```

- Base `3aa146c` is the `int/P7-advanced-semantics` tip (P7 wave-1 already integrated: compatibility, lifecycle, fork-reconciliation, handoff, legacy adapter).
- You are the ONLY writer on this branch/worktree. Never touch: other worktrees, `int/P7-advanced-semantics`, `master`, any other branch, `references/`, the stable deployment `D:\deepseek-harness\`, the :3080 instance.
- **NO push. NO force-push. Ever.**
- **NO real-instance E2E in this task**: no `DSH_HOME`, no booting `node apps/cli/lib/bin.js`, no ports 3180/3181, no mini-MCP (3491–3495). Unit + in-process integration tests only (fakes/in-memory ports), exactly like the wave-1 runtime modules.

## §4 Owned paths (write only here + §6 exception)

- `packages/runtime/mutation/**` — new module directory, primary deliverable (follow wave-1 module pattern: own `index.ts`, `types.ts`, `errors.ts`, pure logic + injected adapters; do NOT use `packages/runtime/src/`, which is the untouched P1-T4 skeleton).
- `packages/runtime/policy/**` and/or `packages/runtime/policy-*.ts` — new policy-adapter files (runtime-side adapters connecting mutation/provenance to the frozen policy domain). New files only.
- `packages/runtime/test/p7t2-*.test.ts` — new test suites (test discovery is `packages/<pkg>/test/*.test.ts` only — top-level test dir; helper files may share the `p7t2-` prefix there).
- DEC-1 formal exception: `packages/testkit/test/p4t6-session-event-scan.test.ts` (count maintenance only, see §6).

**Read-only dependencies you may import but NOT modify:** `packages/domain/policy` (frozen P3-T4 policy engine: `PolicyStateView`, `EffectivePolicy`, `TeamResolvedCell`, `AutonomyOverlayRecord`, `HumanOverrideRecord`, `SuppressedOverlayRecord`, `OverlayOrigin`, `TeamValueOrigin`, `TeamLayer`, `SuppressionReason`, etc. — build on these, do not invent parallel origin/provenance taxonomies), `packages/domain/blueprint`, `packages/contracts` DTOs, and existing runtime modules (`compatibility/` from P7-T1, `control/`, `agent-setup/` incl. `binder/` and `model/overlay.ts`).

Any required write outside the owned paths → do NOT write; report `BLOCKER:OUT_OF_OWNED_PATH:<path>:<reason>` and stop.

## §5 Type/test discipline (zero-core + toolchain)

- CORE PATCH BUDGET = 0: no upstream source changes, no private/internal DSH APIs, no patch-package.
- **No `node:` builtin imports in any `.ts` file** (TS2591). Node builtins allowed only in `.mjs`/`.cjs` harness scripts if genuinely needed (none expected for this task).
- NodeNext + `verbatimModuleSyntax`: relative imports MUST use explicit `.js` extensions.
- Erasable TypeScript only: no `enum`, no namespaces, no parameter properties. No TypeScript outside the sanctioned toolchain.
- Test matchers ONLY: `toBe`, `toEqual`, `toBeGreaterThan`, `toThrow` (and `.not` variants). No other matchers.
- Sanctioned chain ONLY:
  1. `pnpm install --ignore-scripts` (in the worktree root)
  2. `node scripts/run-tests.mjs [pkg]` (no arg = all 9 packages)
  3. tsc per package, **with SEPARATE arguments** (one-string form `'-p <path>'` fails with TS5023):

     ```
     node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json
     ```

     for each of: `contracts`, `domain`, `storage`, `runtime`, `testkit` (the five packages with source).
- NEVER: `pnpm run`, `pnpm exec`, vitest CLI, tsx, esbuild, vite.
- Typecheck note: `packages/runtime/tsconfig.json` includes only `src`, `test`, `vitest.config.ts`; your new `mutation/` and `policy*` sources are typechecked transitively ONLY because tests under `packages/runtime/test/` import them. Ensure every new source file is imported (directly or transitively) by at least one `p7t2-*.test.ts`.

## §6 p4t6 coverage-count maintenance (DEC-1, ratified R29)

The scanner `packages/testkit/fault-injection/session-event-scan.mjs` counts `.ts`/`.mts`/`.mjs` under `packages/<pkg>/` (byte-identical across all branches — do NOT modify it). At base `3aa146c` the committed count is **381**.

After your implementation, let `N` = number of newly added countable files (every new `.ts`/`.mts`/`.mjs` you add under `packages/` — your module sources + tests). Update `packages/testkit/test/p4t6-session-event-scan.test.ts`:

- it-title: substitute the count, keep the rest of the wording exactly: `'coverage: all nine package dirs discovered, nine carry source, <381+N> files scanned, legacy carries the P7-T6 adapter'`
- `filesScanned).toBe(381+N)` and `files.length).toBe(381+N)`
- `withSource.length).toBe(9)` stays (runtime package already carries source)
- legacy-file-count assertion `.toBe(4)` stays (you add no legacy files)
- append a `P7-T2` enumeration comment block to the existing enumeration comment (same style as the P7-T1..T6 blocks already there)

## §7 Implementation requirements (frozen semantics)

1. **Future-boundary mutation**: model/tool/permission/skill/MCP mutations take effect at the next step boundary; in-flight admitted work is unaffected (matrix row: "future request boundary mutation生效；in-flight 不变").
2. **Effective Configuration provenance**: every effective configuration item resolves to an explainable source/origin chain (blueprint/template → policy state → autonomy overlay → human override), reusing `packages/domain/policy` origin vocabularies.
3. **PolicyState suppression/provenance**: suppressed overlays are recorded (`SuppressedOverlayRecord`), not silently dropped; suppression reasons preserved.
4. **Human Override precedence**: human override outranks leader/autonomy; a suppressed override (e.g. blocked by external hard constraint) is recorded with reason.
5. **External hard constraints**: escalation beyond external hard (blueprint/template envelope) is REJECTED — the card's acceptance: 非法 escalation 被拒.
6. **Creation fields immutable after creation**: workspace/context creation fields cannot be illegally mutated post-creation; such attempts are rejected with a typed error.
7. **必须测试 (all four + boundaries)**: all mutation boundaries (model, tool/permission, skill, MCP — each: future takes effect, in-flight unchanged, illegal escalation rejected); suppressed override; human vs leader precedence; external hard rejection. Include negative tests for every boundary.

Design as a pure module with injected ports (step clock / config store / policy reader as interfaces) so tests run in-process with fakes — the established wave-1 pattern. If any capability genuinely requires a non-public upstream seam, STOP and report the exact failure code from §2's matrix; do not work around it.

## §8 Verification chain (serial, INSIDE your worktree — R46 lesson)

All legs run with the worktree as current directory. EVERY log starts with proof lines:

```
git rev-parse --show-toplevel
git rev-parse HEAD
```

1. **Baseline (attempt 1, at base 3aa146c before any code)**: install → full `node scripts/run-tests.mjs` → tsc ×5. Expect **1399/1399 tests, 0 failures** and all tsc exit 0. Log → `dev/agent-workflow/evidence/P7-T2/attempt1-baseline.log`.
   - If baseline ≠ 1399/1399: STOP, report `BLOCKER:BASELINE_DRIFT:<actual totals>` with the log.
2. **Post-implementation (same attempt, same worktree)**: same chain. Expect **1399 + N** tests passing, 0 failures; tsc ×5 exit 0. Log → `dev/agent-workflow/evidence/P7-T2/attempt1-post.log`.
3. **Import-face scan**: grep your new `.ts` files for `node:` imports → expect zero. Record in evidence.
4. **p4t6**: apply §6 update, then run `node scripts/run-tests.mjs testkit` to confirm the p4t6 suite passes with the new count; include that output in the post log (or a note).

## §9 Deliverables & commits

Evidence (new dir `dev/agent-workflow/evidence/P7-T2/`):
- `design-note.md` — port surface, provenance model, mutation-boundary decisions, deviations (if any, justified).
- `attempt1-baseline.log`, `attempt1-post.log` (with §8 proof headers).
- `zero-core-log.md` — import-face + matcher + erasable-TS self-check results.
- `attempt-ledger.md` — `P7-T2: attempt 1/3 — <outcome>`.

Commits on `task/P7-T2-runtime-mutation` (max 2, T4 precedent):
1. Code + tests + p4t6 update — message `P7-T2: runtime mutation/provenance (future-boundary mutation, policy/overlay/override provenance)`.
2. Evidence — message `P7-T2 evidence: design note, chain logs, zero-core, ledger`.

Do not push. Do not modify any file outside owned paths + evidence dir.

## §10 Final report (exact format, in your last message)

```
P7T2_REPORT
branch: task/P7-T2-runtime-mutation
commits: <code-sha> <evidence-sha>   (as returned by git rev-parse)
files: <owned paths added, one per line>
tests: baseline 1399/1399 -> post <1399+N>/<1399+N> (failures 0)
tsc: contracts=0 domain=0 storage=0 runtime=0 testkit=0
p4t6: 381 -> <381+N> (N=<n>; new countable files: <list>)
zero-core: pass
deviations: <none | explicit list>
```

## §11 Failure & blocker protocol

- ≤3 total attempts. A failed attempt = full redo from a clean tree on the same branch (amend/reset locally, never push).
- Blocker (any `BLOCKER:<TYPE>:...` or `STOP → CORE_SEAM_BLOCKER:<seam>`) → commit evidence so far, report the blocker verbatim in the final message, and stop. Main agent handles the next step.
- Never delete or modify files outside your owned paths, never touch other worktrees, never push.
