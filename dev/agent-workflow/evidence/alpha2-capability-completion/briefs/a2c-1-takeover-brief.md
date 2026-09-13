# A2C-1 剩余工作简报（后备：若原 A2C-1 子代理在 Round 23 前仍未产出测试文件，则中断原代理并用本简报重派）

> 前提（主 Agent 已核验 @ Round 22）：原 A2C-1 子代理的全部 GREEN 源编辑已在
> `.worktrees/a2c-1` 落地（9 文件：domain schema/types/validate + a1 测试 pin、
> runtime operation-permission {types,errors,canonical-operation,pre-execute-adapter,index}）。
> 质量预审通过：shell class 词集、byte-identical bash 诊断、单一 canonicalizeShellOperation、
> adapter hunk 仅限分类/词表面（L279 import + L717 exact-inert skip）。
> 未完成 = 测试文件 + RED 取证 + GREEN 运行 + gates + live proof + evidence + report + commit。

## 剩余步骤（按序）

1. **核验现状**（只读）：`git -C .worktrees/a2c-1 status --porcelain`；
   确认 9 文件修改完好、无半成品测试文件残留（若存在半成品 a2c1-*.test.ts 则重写）。
2. **写测试文件** `packages/runtime/test/a2c1-pwsh-permission.test.ts`：
   - 4 条 §5.6 RED probes（pwsh 分类 unsupported / default-deny 不阻止 pwsh / schema 拒 pwsh any ask / 显式挂载无 builtin deny 时 pwsh 可达 executor）
     —— 注意：这些 probe 断言的是 **pre-fix 行为**（"当前被拒绝/绕过"），RED 运行前必须对 pre-fix 树成立（见步骤 3）；
   - 全 §5.7 GREEN acceptance（13 项）：pwsh any deny zero exec / ask Member→Leader 与 Leader→Human /
     allow-once exact command+effect / changed command / changed workdir / background+timeout+sandbox mismatch /
     malformed effect fail closed / builtinToolDeny 更早隐藏 / sibling 不受影响 / cold resume / bash 零回归 /
     hostile end-cap 不回归；
   - runner 约束（plain-node shim）：异步场景 module 级 top-level await + 同步 it 断言；匹配器仅 toBe/toEqual(+.not)；
   - 只 import 既有公共符号（`../../domain/...`、`../operation-permission/index.js` 等）；
   - scanner 自洁净：不得出现 legacy Team SessionEvent denylist token。
3. **RED 取证**（必须对 pre-fix 树）：
   ```bash
   cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a2c-1
   git stash push        # 9 个 tracked 源编辑入 stash；新测试文件（untracked）保留
   pnpm test -- packages/runtime/test/a2c1-pwsh-permission.test.ts > dev/.../a2c-1/red-run.log 2>&1
   git stash pop         # 核验 9 文件全部恢复（git status 对比）
   ```
   RED 日志必须显示 4 条 probe 失败（旧行为成立）。若 pop 有冲突 → 停止并报告。
4. **GREEN 运行**：同命令 → 全绿（probe 转为"已修复"断言的形态若与原 probe 断言冲突，
   按原 probe 语义保留：probe 断言 pre-fix 行为，则 GREEN 后该断言应反转为已修复 —— 实现方式：
   probe 用 `expect(当前行为).toBe(旧行为)` 结构则 GREEN 后必红，故正确做法是 probe 断言
   "缺口存在的可观察事实"（如 schema 拒绝 pwsh），GREEN 后该事实消失 → probe 测试需写成
   **两条**：pre-fix 事实断言（RED 阶段跑，stash 态）+ 修复后行为断言（GREEN 阶段跑）。
   原 A2C-4 子代理的同构做法可参照 `a2c4-external-lastmile.test.ts` 的 RED/GREEN 分段结构。）
5. **Focused gates**：新测试 vitest + `node scripts/run-tests.mjs domain runtime tools` +
   baseline 失败集（`evidence/alpha2-capability-completion/baseline.md`）零新增 +
   `pnpm --filter @dsh-agent-team/domain run typecheck` + `pnpm --filter @dsh-agent-team/runtime run typecheck` +
   `pnpm build` + `node scripts/verify-zero-core.mjs` + private-import 零命中。
6. **Live proof（等效适配）**：本机无 pwsh 二进制 → 临时 3180 族实例 +
   `tests/homes/a2c1-live-<UTC>Z`（TEST_METHODS §7）+ profile-patch 显式挂载 tool-pwsh：
   deny（zero exec）/ ask→deny（zero effect）/ ask→allow_once（permission 层放行计数=1，
   body ENOENT 属预期并区分记录）/ builtinToolDeny（absent + zero rows）/ cold resume。
   若沙箱内 live 链路受阻 → 降级 unit 全覆盖 + 书面说明，不得改测试语义。
7. **Evidence + report**：`dev/agent-workflow/evidence/alpha2-capability-completion/a2c-1/`
   （red-run.log、gate 日志、live 记录、report.md 按简报 §5.6 报告义务格式，含
   `new source/test files added = N` 与 `expected scanner delta = N`）。
8. **Commit**：1–2 个 commit（`A2C-1 ...` 前缀），仅 src + tests + evidence；不 push。
