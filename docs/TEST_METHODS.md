# TEST_METHODS — 测试基础设施与运行约束

> 用户裁决（2026-08-29，第二次裁决为最终）：一切需要**运行中的 DSH 实例**的验证（host smoke、插件 composition、Gate 复跑、E2E）必须使用下列专用测试实例；**严禁影响稳定开发实例**（当前运行中的 harness：GUI :3080，部署检出 `D:\deepseek-harness\`，其默认 DSH_HOME）。

## 1. 测试实例（Team vNext 专用）

| 项 | 值 |
| --- | --- |
| DSH 源码 | `D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use` |
| 基线 | upstream `deepseek-ai/deepseek-harness` master @ `cd5ef8148158c3a752a658978873241fdf8e2bbc`（= 本程序审计基线；checkout 保持 pristine 角色，工作树必须保持 clean） |
| DSH_HOME | `C:/Users/user/.dsh-dev`（测试实例专用 harness home，与稳定实例的默认 `~/.dsh` 完全隔离） |
| 端口 | `3180`（稳定实例占 3080；测试实例禁止使用 3080） |

## 2. 启动 / 停止 / 验证

```powershell
cd D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use
# 首次使用需要：
pnpm install        # node ^22.19 || >=24；packageManager pnpm@11.7.0
# 启动（DSH_HOME 必须显式设置）：
$env:DSH_HOME = 'C:/Users/user/.dsh-dev'
pnpm dsh web --port 3180 --no-open
```

- **验证**：HTTP GET `http://127.0.0.1:3180` 返回 200（GUI shell 页面；仅 `dsh web` 注入 `window.__DSH_BOOT__`，其他入口不是独立应用）。
- **停止**：终止启动它的后台 job（受管 background job）。
- **重建**：测试实例源码树发生任何需要生效的改动后，按其 repo 脚本重建（如 `pnpm run build:web`）；client-plugin HMR 仅在 `pnpm run dev:web`（同一 checkout）watcher 运行时免刷新。
- **CLI 说明**：`--port`/`--host`/`--no-open` 由 web-app 启动模块（`packages/bundle/web-app/src/startup.ts`）解析，默认端口 3080，`--port 0` 让 OS 选空闲端口。

## 3. 硬性约束（禁止项）

1. **禁止**启动/停止/重建/修改稳定开发实例：`D:\deepseek-harness\` 部署检出、:3080 端口的 GUI、以及稳定实例的 DSH_HOME。
2. **禁止**在 3080 端口或稳定实例 DSH_HOME 上启动任何 DSH 实例。
3. **禁止**把 `references\deepseek-harness`（冻结 legacy fork 参考，HEAD 锁定 `a3ab319927...`，tag `legacy-agent-team-pre-vnext`）用作测试运行时；它仅作证据/参考。
4. test-use checkout 只承担 **pristine upstream** 角色：需要 "active downstream host" 状态的测试（如 P1-T5 zero-core smoke 的 downstream 侧、G1 复跑）在 downstream 分支的 worktree（`.worktrees\P1-T1-host` 等）或对应分支检出上进行，不得向 test-use 源码树写入开发内容。
5. 测试日志/产物写入 Team 仓库 `dev/agent-workflow/evidence/<task>/`；测试运行后必须确认 test-use 工作树 `git status --porcelain` 仍为空。

## 4. 与程序任务的关系

- **P1-T5（zero-core compliance + G1 smoke）**：pristine upstream smoke = 按 §2 启动 test-use 实例 → GUI 健康 → 以 public seam 方式挂载 empty plugin → 运行后复核 test-use 工作树 byte-clean（status 空 + diff 空）。
- **G1-REVIEW**：reviewer 必须按 §2 同流程复跑 smoke，并亲自确认运行后 byte-clean。
- 后续 Phase 中任何 "需要运行中 host" 的必须测试，默认路径都是本实例；若某任务确实需要第二实例（如并行 host 对照），端口必须避开 3080/3180 并在 evidence 中登记。

## 5. 裁决历史

- 2026-08-29 第一次裁决：测试源码用 `D:/AgentDev/deepseek-harness`（需切 master；DSH_HOME=`C:/Users/user/.dsh-dev`，port=3180）。
- 2026-08-29 第二次裁决（**最终，取代第一次**）：测试源码改用 `references\deepseek-harness-test-use`；DSH_HOME 与端口不变。`D:/AgentDev/deepseek-harness` 不再被本程序使用，保持原样。
