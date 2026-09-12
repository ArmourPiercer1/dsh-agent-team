# TEST_METHODS — 测试基础设施与运行约束

> 用户裁决（2026-08-29，第二次裁决为最终）：一切需要**运行中的 DSH 实例**的验证（host smoke、插件 composition、Gate 复跑、E2E）必须使用下列专用测试实例；**严禁影响稳定开发实例**（:3080 端口的 GUI 实例及其 DSH_HOME；原 Windows 部署检出 `D:\deepseek-harness\`）。
>
> **留痕变更（2026-09-12，test-infra-standardization，用户指令"执行改动并完成进一步规范化"）**：测试基础设施整体迁入 `tests/`——(a) pristine 测试运行时 checkout 由 `references/deepseek-harness-test-use` 移为 **`tests/deepseek-harness-test-use`**；(b) 一切 DSH_HOME 由 `references/.dsh-test*` 移为 **`tests/homes/<world>`**（命名/清理协议见 §7）；(c) 基线对齐：TEST_METHODS 正文的 `76fda72979` 更正为 **`a66e470204`**（0.1.2-rc.1 官方 release 提交 = 实际 checkout 点；`76fda72979` 是同 rc 线其后一个 descendant merge（PR #3481），2026-09-11 H1 D9 已对齐 AGENTS.md，本次对齐本文；`cd5ef814` 为 P2 时代基线，characterization fixture/CI 仍 pin 之，见 §4.2）。端口策略（3180 族、禁 3080）与稳定实例红线**不变**。`tests/paths.mjs` 为路径唯一来源。旧 `references/.dsh-test*` 世界**不迁移**（历史记录，原地保留）。

## 1. 测试实例（Team vNext 专用）

| 项 | 值 |
| --- | --- |
| DSH 源码 | `<repo>/tests/deepseek-harness-test-use`（pristine upstream checkout；**自身 git 仓**，detached 于基线；gitignored；工作树必须保持 clean） |
| 基线 | upstream `deepseek-ai/deepseek-harness` @ **`a66e4702047846cdaa10c66c9d3df3951f5ea70d`**（官方 `release(dsh): 0.1.2-rc.1` 提交 = 本程序审计基线；短形式 `a66e470204`；canonical 常量见 `tests/paths.mjs` 的 `TEST_USE_BASELINE_SHA` / `CLIENT_COMMIT_HASH`） |
| DSH_HOME | `<repo>/tests/homes/<world>`（一世界一目录；**位于会话工作区内**——见 §5 沙箱约束；与稳定实例的默认 `~/.dsh` 完全隔离；`tests/homes/` 已被 `.gitignore` 覆盖；协议见 §7） |
| 端口 | `3180` 族（3180-3186 / 3491-3500；稳定实例占 3080；测试实例**禁止**使用 3080） |

> 落位方法（本环境实测 2026-09-12）：`git clone --local references/deepseek-harness tests/deepseek-harness-test-use && git -C tests/deepseek-harness-test-use checkout --detach a66e470204`（冻结 legacy 参考仓含完整 upstream 历史，无需网络；等价地可从 upstream 远端 clone）。落位后必须复核 `git status --porcelain` 为空。

## 2. 启动 / 停止 / 验证

```bash
cd <repo>/tests/deepseek-harness-test-use
# 首次使用需要：
pnpm install --ignore-scripts   # node ^22.19 || >=24；packageManager pnpm@11.7.0
                                # --ignore-scripts：受限沙箱禁止 piped-stdio 子进程 spawn（lifecycle 脚本 EPERM）；
                                # 预编译原生包（node-pty/koffi/esbuild 平台二进制）不受影响
# 构建（必须；web 运行时从 lib/ 加载，且需 client 产物）：
DSH_CLIENT_COMMIT_HASH=a66e470204 \
ESBUILD_WORKER_THREADS=1 \
node scripts/build.ts           # 直接 node 跑 TS orchestrator（v24 原生 type-stripping），绕开 tsx
# 启动（DSH_HOME 必须显式设置；用构建产物入口，绕开 tsx 的同步 esbuild spawn）：
DSH_HOME=<repo>/tests/homes/<world> node apps/cli/lib/bin.js web --port 3180 --no-open
```

> **为什么不是 `pnpm dsh web`**：`pnpm dsh` 经 `node --import tsx/esm` 启动，tsx 走 esbuild 同步 API（强制子进程 spawn），在受限沙箱下必然 EPERM。构建产物入口 `apps/cli/lib/bin.js` 是纯 Node ESM，运行期插件均从 `lib/` 加载。上述 env 组合在任何环境下都成立（确定性 pin + 无 spawn 依赖），受限与不受限环境通用。

- **验证**（2026-08-29 实测语义，0.1.2-alpha.1；2026-09-04 于 0.1.2-rc.1 复测成立，R122）：
  1. 启动行 `dsh web: http://127.0.0.1:3180/?token=...` 出现 = host boot 完成（plugin tree loaded）。
  2. `GET /`（无 token）→ **401** = 启动 token 鉴权门生效。
  3. `GET /?token=<launch-token>` → 200 需前端 bundle（`apps/web/dist`）；沙箱内不可构建时为 **404**——不影响无浏览器 GUI 项的 Gate 判据。如某 Phase 确需渲染 GUI：在工作区外手动 `pnpm build:web` 一次（gitignored 产物，不违反 pristine 角色），并在 evidence 登记。
  4. 全程复核稳定实例：`GET :3080` 状态与操作前一致且未做任何操作。
- **停止**：终止启动它的后台 job（受管 background job）。
- **重建**：测试实例源码树发生任何需要生效的改动后，按其 repo 脚本重建（如 `pnpm run build:web`）；client-plugin HMR 仅在 `pnpm run dev:web`（同一 checkout）watcher 运行时免刷新。
- **CLI 说明**：`--port`/`--host`/`--no-open` 由 web-app 启动模块（`packages/bundle/web-app/src/startup.ts`）解析，默认端口 3080，`--port 0` 让 OS 选空闲端口。

## 3. 硬性约束（禁止项）

1. **禁止**启动/停止/重建/修改稳定开发实例：:3080 端口的 GUI 实例及其 DSH_HOME（原 Windows 部署检出 `D:\deepseek-harness\`）。
2. **禁止**在 3080 端口或稳定实例 DSH_HOME 上启动任何 DSH 实例。
3. **禁止**把 `references/deepseek-harness`（冻结 legacy fork 参考，tag `legacy-agent-team-pre-vnext` → `a3ab319927...`，只读）用作测试运行时；它仅作证据/参考，且**不得移动**。
4. `tests/deepseek-harness-test-use` 只承担 **pristine upstream** 角色：不得向该源码树写入开发内容；需要 "active downstream host" 状态的测试在 downstream 分支的 worktree（`.worktrees/<task>` 等）或对应分支检出上进行。
5. 测试日志/产物写入 Team 仓库 `dev/agent-workflow/evidence/<task>/`；测试运行后必须确认 test-use 工作树 `git status --porcelain` 仍为空、`git rev-parse HEAD` 仍等于基线。
6. **禁止**把 DSH_HOME 或测试世界状态提交入库（`tests/homes/` 与 `tests/deepseek-harness-test-use/` 均 gitignored，含 launch token）。

## 4. 与程序任务的关系

- **P1-T5（zero-core compliance + G1 smoke）及一切 "需要运行中 host" 的任务**：pristine upstream smoke = 按 §2 启动 test-use 实例 → host boot 健康（§2 验证 1+2）→ 以 public seam 方式（`DSH_HOME/profiles/web` bundles / `cordis.patch.yml`）挂载 empty plugin 并确认加载 → 停止实例 → 运行后复核 test-use 工作树 byte-clean（`git status --porcelain` 空 + `git diff` 空）。
- **G1-REVIEW**：reviewer 必须按 §2 同流程复跑 smoke，并亲自确认运行后 byte-clean。
- 后续任何 "需要运行中 host" 的必须测试，默认路径都是本实例；若某任务确实需要第二实例（如并行 host 对照），端口必须避开 3080/3180 并在 evidence 中登记。
- **4.1 测试 kit 归位**：可复用、与任务线无关的 kit 放 `tests/kits/`（tracked，必须从 `tests/paths.mjs` 取路径）；任务专属 kit 留在 `dev/agent-workflow/evidence/<task>/`（自包含证据，不清理）；共享原语优先用 `tests/characterization/lib/`（instance.mjs / util.mjs / tree-clean.mjs）。
- **4.2 pin 代差（已登记，勿混淆）**：`tests/characterization/fixtures/host-version.json` 与其 CI job（`.github/workflows/characterization.yml`）pin **`cd5ef814`（0.1.2-alpha.1，P2 时代基线）**——characterization 的 pin-drift fixture 在该 pin 上录制，移动 pin 属于刻意的 `--fixture-write` 重录行为（独立 bounded task）。本文 §1 的 `a66e470204` 是**测试运行时**基线，两者不同源、各自锁定；CI 仅随本次布局迁移改路径，pin 不动。

## 5. 沙箱约束（历史实测 + 当前环境）

- **2026-08-29（Windows，workspace-write 模式，实测）**：工作区外写入拒绝；**任何 node 进程发起的 piped-stdio 子进程 spawn → EPERM**（esbuild service、node→git、node→node 均中招）。可用绕行组合即 §2 的构建/启动链。`sandbox_permissions` 一次性扩权需用户逐项批准；"替我审批"自动批准实测未生效。**测试实例工作默认在 workspace-write 内完成，不发起升级请求。**
- **2026-09-12（Linux 本环境，实测）**：node 24.21.0 / pnpm 11.7.0 / git 2.53；`spawnSync('echo')` OK——piped-stdio spawn 未被拒绝。§2 的 env/入口链仍为标准（确定性 + 受限环境兼容），但 EPERM 不预期；如遇平台差异按留痕先例处理并在 evidence 登记。
- 通用不变量：**DSH_HOME 必须位于会话工作区内**（本环境 workspace 为 `/home/user/dsh-plugins/dsh-agent-team`；`tests/homes/` 满足）。

## 6. 裁决历史

- 2026-08-29 第一次裁决：测试源码用 `D:/AgentDev/deepseek-harness`（需切 master；DSH_HOME=`C:/Users/user/.dsh-dev`，port=3180）。
- 2026-08-29 第二次裁决（取代第一次）：测试源码改用 `references\deepseek-harness-test-use`；DSH_HOME 与端口不变。`D:/AgentDev/deepseek-harness` 不再被本程序使用，保持原样。
- 2026-08-29 第三次裁决（取代第二次的 DSH_HOME）：DSH_HOME 改为工作区内 `references/.dsh-test`（原因见 §5）。源码、端口、其余约束不变。
- 2026-09-04（R122 留痕）：基线随 upstream in-place 更新移至 0.1.2-rc.1；host-service-registry 语义缝隙（`sessionPersistence.ensureMaterialized` → `sessions.flush`）为上游 rc.1 自有替换，非 CORE_SEAM_BLOCKER。
- 2026-09-12（本次）：测试基础设施标准化——布局迁入 `tests/`（§1）、基线对齐 `a66e470204`（§1 + 文首留痕）、home 协议（§7）、kit 归位（§4.1）、pin 代差登记（§4.2）。端口策略与稳定实例红线不变。

## 7. DSH_HOME 命名与清理协议（`tests/homes/`，2026-09-12 新增）

- **共享持久 home**：`.dsh-test` —— 既有 durable 行**保留、永不销毁**（d4/g5 harness 约定）。
- **临时世界**：`<line>-<UTC 时间戳>`（例 `rmr-rev7-20260912T03-00-00Z`）；一世界一目录；teardown 时删除，**除非**作为证据保留（保留则必须在任务 evidence 目录登记路径）。
- **长生命周期任务 home**：`.dsh-test-<task>`（例 `.dsh-test-p8s3`）；新鲜性（FRESH/fail-closed）规则属于消费它的 harness 自身。
- **锁文件**与 home 同处：`<home>.lock`。
- 历史 home（旧布局 `references/.dsh-test*`，若存在）**不迁移**；新工作一律使用 `tests/homes/`。
- 一切 home 均含 launch token 与世界状态：**永不提交**；删除世界属于影响面操作，须在 evidence 留痕。
