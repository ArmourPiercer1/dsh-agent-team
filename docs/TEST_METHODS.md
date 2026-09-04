# TEST_METHODS — 测试基础设施与运行约束

> 用户裁决（2026-08-29，第二次裁决为最终）：一切需要**运行中的 DSH 实例**的验证（host smoke、插件 composition、Gate 复跑、E2E）必须使用下列专用测试实例；**严禁影响稳定开发实例**（当前运行中的 harness：GUI :3080，部署检出 `D:\deepseek-harness\`，其默认 DSH_HOME）。

## 1. 测试实例（Team vNext 专用）

| 项 | 值 |
| --- | --- |
| DSH 源码 | `D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use` |
| 基线 | upstream `deepseek-ai/deepseek-harness` master @ `76fda729799fe9b3848dbe2c211d4b231032b81e`（= 本程序审计基线；checkout 保持 pristine 角色，工作树必须保持 clean） |
| DSH_HOME | `D:/AgentDev/dsh-plugins/dsh-agent-team/references/.dsh-test`（测试实例专用 harness home，**位于会话工作区内**——见 §6 沙箱约束；与稳定实例的默认 `~/.dsh` 完全隔离；`references/` 已被 `.gitignore` 覆盖） |
| 端口 | `3180`（稳定实例占 3080；测试实例禁止使用 3080） |

> **留痕变更（2026-09-04，R122，SESSION_ROUTER_LOG）**：基线随用户对 upstream 的 in-place 更新移至 0.1.2-rc.1 @ `76fda72979`；全仓库兼容适配在 `task/upstream-rc1-compat`（upstream 零改动，全部适配在本仓库侧；其中一处 host-service-registry 语义缝隙 `sessionPersistence.ensureMaterialized` → `sessions.flush` 为上游 rc.1 自有替换，非 CORE_SEAM_BLOCKER）。Boot/gentry 证据：`dev/agent-workflow/evidence/upstream-rc1-compat/`（compat-matrix、L2 裁决、闸日志）与 `dev/agent-workflow/evidence/P9/s8/`（state.json、gentry-report.json `failures []`、干净世界冒烟）。

## 2. 启动 / 停止 / 验证

```powershell
cd D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use
# 首次使用需要：
pnpm install --ignore-scripts   # node ^22.19 || >=24；packageManager pnpm@11.7.0
                                # --ignore-scripts：沙箱禁止 piped-stdio 子进程 spawn（lifecycle 脚本 EPERM）；
                                # 预编译原生包（node-pty/koffi/esbuild 平台二进制）不受影响（P1-T1 已验证）
# 构建（必须；web 运行时从 lib/ 加载，且需 client 产物）：
$env:DSH_CLIENT_COMMIT_HASH = '76fda72979'   # 跳过构建内的 git spawn（沙箱 EPERM）
$env:ESBUILD_WORKER_THREADS = '1'          # esbuild 用 worker_threads 替代子进程
node scripts/build.ts                       # 直接 node 跑 TS orchestrator（v24 原生 type-stripping），绕开 tsx
# 启动（DSH_HOME 必须显式设置；用构建产物入口，绕开 tsx 的同步 esbuild spawn）：
$env:DSH_HOME = 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.dsh-test'
node apps/cli/lib/bin.js web --port 3180 --no-open
```

> **为什么不是 `pnpm dsh web`**：`pnpm dsh` 经 `node --import tsx/esm` 启动，tsx 走 esbuild 同步 API（强制子进程 spawn），在 workspace-write 沙箱下必然 EPERM。构建产物入口 `apps/cli/lib/bin.js` 是纯 Node ESM，运行期插件均从 `lib/` 加载，无 spawn 依赖。

- **验证**（2026-08-29 实测语义，0.1.2-alpha.1；2026-09-04 于 0.1.2-rc.1 复测成立，R122）：
  1. 启动行 `dsh web: http://127.0.0.1:3180/?token=...` 出现 = host boot 完成（plugin tree loaded）。
  2. `GET /`（无 token）→ **401** = 启动 token 鉴权门生效（稳定实例 0.1.1-rc.2 无此门）。
  3. `GET /?token=<launch-token>` → 200 需前端 bundle（`apps/web/dist`）；沙箱内不可构建（vite→esbuild spawn EPERM，见 §5），故当前为 **404**——**不影响 G1 判据**（DevPlan §13.6 无浏览器 GUI 项）。如某 Phase 确需渲染 GUI：用户在工作区外手动 `pnpm build:web` 一次（gitignored 产物，不违反 pristine 角色），并在 evidence 登记。
  4. 全程复核稳定实例：`GET :3080` 仍 200 且未做任何操作。
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

- **P1-T5（zero-core compliance + G1 smoke）**：pristine upstream smoke = 按 §2 启动 test-use 实例 → host boot 健康（§2 验证 1+2）→ 以 public seam 方式（`DSH_HOME/profiles/web` bundles / `cordis.patch.yml`，见 evidence/test-infra/setup-20260829.md §6）挂载 empty plugin 并确认加载 → 停止实例 → 运行后复核 test-use 工作树 byte-clean（`git status --porcelain` 空 + `git diff` 空）。
- **G1-REVIEW**：reviewer 必须按 §2 同流程复跑 smoke，并亲自确认运行后 byte-clean。
- 后续 Phase 中任何 "需要运行中 host" 的必须测试，默认路径都是本实例；若某任务确实需要第二实例（如并行 host 对照），端口必须避开 3080/3180 并在 evidence 中登记。

## 5. 沙箱约束（2026-08-29 实测，workspace-write 模式）

- 工作区（`D:\AgentDev\dsh-plugins\dsh-agent-team`）外写入 → 拒绝（`UnauthorizedAccessException`）；**因此 DSH_HOME 必须位于工作区内**（§1）。
- **任何 node 进程发起的 piped-stdio 子进程 spawn → EPERM**（esbuild service、node→git、node→node 均中招；esbuild 同步 API 强制子进程，`ESBUILD_WORKER_THREADS=1` 对同步路径无效）。
- 不受限：pwsh 层面的 spawn（pwsh→git/node 正常）；`stdio: 'inherit'` 的 spawn（`scripts/build.ts` 的 runScript）。
- 可用绕行组合即 §2 的构建/启动链：`--ignore-scripts` 安装 → 原生 node type-stripping 跑 build orchestrator（注入 `DSH_CLIENT_COMMIT_HASH` 跳过其内部 git spawn）→ `node apps/cli/lib/bin.js` 启动。
- 升级路径（`sandbox_permissions` 一次性扩权）仍需用户逐项批准；"替我审批"自动批准实测未生效（请求仍到达用户，2026-08-29 一次探针被拒）。**后续测试实例工作默认在 workspace-write 内完成，不发起升级请求。**

## 6. 裁决历史

- 2026-08-29 第一次裁决：测试源码用 `D:/AgentDev/deepseek-harness`（需切 master；DSH_HOME=`C:/Users/user/.dsh-dev`，port=3180）。
- 2026-08-29 第二次裁决（取代第一次）：测试源码改用 `references\deepseek-harness-test-use`；DSH_HOME 与端口不变。`D:/AgentDev/deepseek-harness` 不再被本程序使用，保持原样。
- 2026-08-29 第三次裁决（**当前生效**，取代第二次的 DSH_HOME）：DSH_HOME 改为工作区内 `references/.dsh-test`（原因见 §5）。源码、端口、其余约束不变。
