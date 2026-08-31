# P8-T2 Worker Brief — Projection Service (Round R52)

> Base: `48b3334fb1ed00e79929372ddd627db6e6162ccc` (= int/P8-remote-projection tip, post P8-T1; chain 1638/1638 + tsc x5 verified at this SHA; p4t6 = 428 / withSource 9 / legacy 21).
> Card: TaskDoc §11.9 P8-T2. Class A. Worker attempts allowed: 3 (this dispatch is attempt 1).
> You are the only writer on your branch/worktree.

## §0 MANDATORY FIRST STEP

Read in your worktree, complete: `docs/ROUTER_RULES.md` and `docs/TEST_METHODS.md`. Then verify the frozen docs (§2 hashes) and read the gate-relevant sections. Do not skip on familiarity.

## §1 Task card (TaskDoc §11.9, verbatim)

P8-T2 — Projection service
- 目标：从 TeamDomain + live residency overlay 生成 whole projection；禁止扫描全部 Session logs 重建 Team truth。
- 拥有的文件/包：`packages/runtime/projection/**`
- 前置依赖：P8-T1（已完成 —— base 含 projection DTO v1，`packages/contracts/src/projection/**`，纯读）
- 允许依赖：TeamDomain read APIs + live residency read-only
- 禁止项：全局 forbidden block（见 §8）
- 实现要点：ledger pagination 单独处理；projection pure-ish fold 可单测。
- 必须测试：cold projection；50 instances；live overlay；disposed/archived。
- 验收标准：projection 与 durable truth 一致，复杂度不依赖完整 child logs。
- 输出物：projection package；tests
- 难度：R5/C5/T5；推荐 Class A。
- 并行关系：I1（P8 第二任务，本波无并行任务）。
- 审查重点：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

## §2 Frozen documents (verify sha256 before relying on them)

- Architecture `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53`
- UI `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e`
- Development Plan `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f`
- Task Decomposition `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3`

Design constraints to honor (read DevPlan §21 in full):
- §21.2 Projection source = `TeamDomain + optional current live residency/activity overlay`. You must NOT scan `Root + all child Session logs` to rebuild Team control truth. The service must read ONLY durable TeamDomain state plus the read-only live overlay; everything else is out of scope by construction.
- §21.4 First version correctness first: the projection carries the (monotonic) generation established by the P8-T1 DTO; the service must produce projections whose generation makes stale-overwrite detection possible downstream.
- The DTO is FROZEN by P8-T1 (`packages/contracts/src/projection/**`): consume it read-only, do not modify it (its owner is the P8-T1 write lock; you may file a `BLOCKER:SPEC` if a field is genuinely missing).
- Object model (Architecture doc): TeamBlueprint → TeamSession + TeamDomain → MemberInstance; frozen lifecycle states — use the authoritative state sets from the Architecture doc and the P8-T1 `states` module; do not invent states.

## §3 Identity & environment

- Repo: `D:\AgentDev\dsh-plugins\dsh-agent-team`. The main worktree (on master) is NOT yours — never write there.
- Base SHA: `48b3334fb1ed00e79929372ddd627db6e6162ccc` (verify it resolves and equals `int/P8-remote-projection` before branching).
- Create branch + worktree:
  `git -C D:\AgentDev\dsh-plugins\dsh-agent-team worktree add -b task/P8-T2-projection-service .worktrees/P8-T2 48b3334fb1ed00e79929372ddd627db6e6162ccc`
- In your worktree: `pnpm install --ignore-scripts` (log to your evidence dir).
- Your only writes: your worktree (incl. node_modules via install) + your evidence dir `dev/agent-workflow/evidence/P8-T2/`.
- NO push. NO force-push. Never touch other worktrees, `master`, the `int/*` branches, `references/deepseek-harness` (read-only), the stable deployment `D:\deepseek-harness\`, or the :3080 instance.

## §4 Owned paths (write lock)

- `packages/runtime/projection/**` — your exclusive write surface (new directory).
- Inspect FIRST: `packages/runtime` (index/exports, module conventions, how P7 modules structure ports/folds) and `packages/domain` (the actual TeamDomain READ APIs you may consume) and `packages/contracts/src/projection` (the frozen DTO you must produce). Follow package conventions; additive index/export changes inside `packages/runtime` are allowed only if the package convention requires them — keep them minimal.
- DEC-1 standing exception: `packages/testkit/test/p4t6-session-event-scan.test.ts` (coverage-count maintenance, §6).
- Any write outside these paths → STOP: `BLOCKER:OWNED_PATH:<path>`.
