# TEST_METHODS — 测试基础设施与运行约束

> 用户裁决（2026-08-29，第二次裁决为最终）：一切需要**运行中的 DSH 实例**的验证（host smoke、插件 composition、Gate 复跑、E2E）必须使用下列专用测试实例；**严禁影响稳定开发实例**（:3080 端口的 GUI 实例及其 DSH_HOME；原 Windows 部署检出 `D:\deepseek-harness\`）。
>
> **留痕变更（2026-09-12，test-infra-standardization，用户指令"执行改动并完成进一步规范化"）**：测试基础设施整体迁入 `tests/`——(a) pristine 测试运行时 checkout 由 `references/deepseek-harness-test-use` 移为 **`tests/deepseek-harness-test-use`**；(b) 一切 DSH_HOME 由 `references/.dsh-test*` 移为 **`tests/homes/<world>`**（命名/清理协议见 §7）；(c) 基线对齐：TEST_METHODS 正文的 `76fda72979` 更正为 **`a66e470204`**（0.1.2-rc.1 官方 release 提交 = 实际 checkout 点；`76fda72979` 是同 rc 线其后一个 descendant merge（PR #3481），2026-09-11 H1 D9 已对齐 AGENTS.md，本次对齐本文；`cd5ef814` 为 P2 时代基线，characterization fixture/CI 仍 pin 之，见 §4.2）。端口策略（3180 族、禁 3080）与稳定实例红线**不变**。`tests/paths.mjs` 为路径唯一来源。旧 `references/.dsh-test*` 世界**不迁移**（历史记录，原地保留）。

## 1. 测试实例（Team vNext 专用）

| 项 | 值 |
| --- | --- |
| DSH 源码 | `<repo>/tests/deepseek-harness-test-use`（pristine upstream checkout；**自身 git 仓**，detached 于基线；gitignored；工作树必须保持 clean） |
| 基线 | **0.2.0-rc.2 @ `639ed015397290b3745d163aafe02ffee4aa3f84`**（2026-10-03 宿主升级轮起）= fork `ArmourPiercer1/deepseek-harness` 分支 **`stable-3-0.2.0-rc.2`** tip（= upstream `release(dsh): 0.2.0-rc.2`（`c1b47e41fc`）+ 其 release-PR merge PR #5479；fork 内**无** `dsh-v0.2.0-rc.2` tag，锚点 = 分支名 + 完整 SHA；短形式 `639ed01539`；canonical 常量 = `tests/paths.mjs` 的 `DSH_BASELINE_VERSION` / `TEST_USE_BASELINE_SHA` / `CLIENT_COMMIT_HASH`）。上一基线：0.1.7-rc.1 @ `46a7f68b0922371ce7144b668b90e377d8e799f4`（2026-09-24 … 2026-10-03）。**DSH 0.1.2 自 2026-09-17 起不再支持**（用户裁决，rc2-repair 轮基线）；0.1.5-rc.2 @ `fb2c4b9e69` 为 2026-09-17 … 2026-09-24 基线（升级轮前） |
| DSH_HOME | `<repo>/tests/homes/<world>`（一世界一目录；**位于会话工作区内**——见 §5 沙箱约束；与稳定实例的默认 `~/.dsh` 完全隔离；`tests/homes/` 已被 `.gitignore` 覆盖；协议见 §7） |
| 端口 | 测试端口段（唯一来源 `tests/paths.mjs` 的 `TEST_PORT_RANGES`）：**3180-3199 / 3491-3500 / 13000-13099**（2026-10-26 用户裁决放宽，见 §6；此前 3180-3186 / 3491-3500）；WorldFactory 按角色分段租用：宿主 `HOST_PORT_BANDS` = 3181-3199 → 13000-13049（**3180 不租给 World**，留给 §2 手动启动与 kit），mock `MOCK_PORT_BANDS` = 3491-3500 → 13050-13099；旧 `tests/kits/**` 自带候选表仍在旧段内、不改；稳定实例占 3080；测试实例**禁止**使用 3080 |

> 落位方法（**历史**，本环境实测 2026-09-12，0.1.2 时代）：`git clone --local references/deepseek-harness tests/deepseek-harness-test-use && git -C tests/deepseek-harness-test-use checkout --detach a66e470204`（冻结 legacy 参考仓含完整 upstream 历史，无需网络；等价地可从 upstream 远端 clone）。**当前流程（2026-09-24 宿主升级轮起；2026-10-03 0.2.0-rc.2 轮补充 fresh-worktree 情形）**：checkout 已在位（detached @ 基线）时，升级/重建基线 = `git -C tests/deepseek-harness-test-use fetch origin && git -C tests/deepseek-harness-test-use checkout --detach <TEST_USE_BASELINE_SHA>`；全新 worktree 尚无 checkout 时 = `git clone --local --no-hardlinks <只读 baseline 树> tests/deepseek-harness-test-use` + `git checkout --detach <TEST_USE_BASELINE_SHA>`（本仓库 worktree 与 baseline 常跨设备，`--local` 的硬链接会被 `Invalid cross-device link` 拒；`--no-hardlinks` = 完整对象副本）。canonical 常量唯一来源 = `tests/paths.mjs`，当前 `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2）。落位后必须复核 `git status --porcelain` 为空；**并复核原生沙箱资产已供给**（`node tests/world-factory/provision-host-sandbox.mjs --check`，见 §9——clone 不携带 `native/system/packages/*/bin/`，未供给时宿主沙箱后端 `unusable`）。

## 2. 启动 / 停止 / 验证

```bash
cd <repo>/tests/deepseek-harness-test-use
# 首次使用需要：
pnpm install --ignore-scripts   # node ^22.19 || >=24；packageManager pnpm@11.7.0
                                # --ignore-scripts：受限沙箱禁止 piped-stdio 子进程 spawn（lifecycle 脚本 EPERM）；
                                # 预编译原生包（node-pty/koffi/esbuild 平台二进制）不受影响
# 构建（必须；web 运行时从 lib/ 加载，且需 client 产物）：
DSH_CLIENT_COMMIT_HASH=639ed01539 \
ESBUILD_WORKER_THREADS=1 \
pnpm run build                  # 必须经 pnpm run 调用：0.1.7/0.2.0 scripts/build.ts 经
                                # pnpmInvocation() 解析包管理器入口（读 npm_execpath，
                                # 缺失直接 throw），再 spawnSync 子构建。普通终端直接
                                # `node scripts/build.ts` 会失败（2026-09-28 实测
                                # exit 1: "pnpm invocation: npm_execpath is unavailable;
                                # invoke the script through pnpm run."；`pnpm run build`
                                # 同条件实测 exit 0，263 client artifacts）
# 启动（DSH_HOME 必须显式设置；用构建产物入口，绕开 tsx 的同步 esbuild spawn）：
DSH_HOME=<repo>/tests/homes/<world> node apps/cli/lib/bin.js web --port 3180 --no-open
```

> **为什么启动不用 `pnpm dsh web`**：`pnpm dsh` 经 `node --import tsx/esm` 启动，tsx 走 esbuild 同步 API（强制子进程 spawn），在受限沙箱下必然 EPERM。构建产物入口 `apps/cli/lib/bin.js` 是纯 Node ESM，运行期插件均从 `lib/` 加载。`DSH_CLIENT_COMMIT_HASH` 是确定性 pin（构建编排器据此跳过 git spawn 查版本）。**勘误（2026-09-28 审查轮）**：旧版此处称构建链"无 spawn 依赖"——对 0.1.7 不成立：`scripts/build.ts` 经 `pnpmInvocation()` + `spawnSync` 驱动子构建（stdio inherit，实测受限沙箱内可行），故构建必须经 `pnpm run` 调用（见上方命令）；受限/不受限环境通用的保证仅对**启动**路径（`node apps/cli/lib/bin.js`）与上述 env 组合成立。

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
- **4.2 characterization pin 与 CI（2026-09-17 已收束 + 降级 manual）**：`tests/characterization/fixtures/host-version.json` 与其 CI job（`.github/workflows/characterization.yml`）曾 pin `cd5ef814`（0.1.2-alpha.1，P2 时代基线），与本文 §1 的**测试运行时**基线不同源、各自锁定。2026-09-17（rc2-repair 收束，用户指令）：两 pin 统一至 **`fb2c4b9e69`（0.1.5-rc.2 官方发布点；0.1.2 不再支持）**——fixture 经 `--fixture-write` 在新 pin 上重录（evidence `dev/agent-workflow/evidence/rc2-repair/ci-migration-local/`）；CI build step 改经 `pnpm run build` 调用（upstream 构建脚本的 `npm_execpath` 契约；此前 `node scripts/build.ts` 直调在 CI 恒失败 = PR #16/#17/#18 的既有红 check）。**同时该 job 从 active gate 降级为 workflow_dispatch manual（archival）**：P2 时代 probes 对 0.1.2 录制，新 pin 下本地全量自检 probe 段 107 项失败，三个已定位根因（p2t2/p2t3 会话日志名 `session.jsonl.zstd` → 0.1.5 的 `session.v3.jsonl.zstd`；p2t4 `tools.schemas()` row scope 形状漂移；p2t5 B1/B2 实例 boot exit 1 待留痕复诊）——probe 对 0.1.5-rc.2 的重录是独立 bounded follow-up task。降级前该 check 从未绿（CI 恒红于 build step），不构成活跃门禁损失；仓库活跃门禁 = 全仓测试套件 + 真宿主 smoke kit（`tests/kits/rc2-real-host-smoke`）。 **2026-10-03（0.2.0-rc.2 宿主升级轮，用户指令）**：该 fixture 与 CI job 继续留在 `fb2c4b9e69`（0.1.5-rc.2）作为 **archived/manual 基线**——本轮**不**重录、**不**重跑、**不**把它标为 0.2.0-rc.2 green；0.2 的活跃门禁 = 全仓测试套件 + 真宿主 smoke kit（其 pin 自 2026-10-03 起一律取自 `tests/paths.mjs`，不再硬编码代次）。

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
- 2026-09-17（rc2-repair 轮，用户裁决"本轮基线 0.1.5-rc.2，后续不再为 0.1.2 提供支持"）：测试运行时基线 `a66e470204`（0.1.2-rc.1）→ **`fb2c4b9e698e30edb738bca4cf0618587db7d203`**（0.1.5-rc.2 官方发布点，与 `docs/plans/active/dsh-agent-team-rc2-repair-plan.md` §0.1 宿主提交逐字一致）。test-use 检出已迁移（`git checkout --detach`，对象本地已有、无网络；porcelain 迁移前后均为空）；`pnpm install --ignore-scripts` + `DSH_CLIENT_COMMIT_HASH=fb2c4b9e69 node scripts/build.ts` 重建成功；3181 新 home（`tests/homes/.dsh-test-rc2b`）启动冒烟：boot 行出现 + 无 token 401 + token 303 鉴权放行；`tests/paths.mjs` pin 与 AGENTS.md 基线行同步更新。`references/deepseek-harness` 工作树同期已由用户切至 `stable-1-0.1.5-rc.2` @ 同提交（冻结 legacy 锚点 `a3ab319927` 未移动，本环境复核）。§4.2 的 characterization pin（`cd5ef814`）为独立来源，当轮不动（该裁决后于 2026-09-17 收束工作中被用户指令推翻，pin 已迁 `fb2c4b9e69`，见 §4.2）。端口策略与稳定实例红线不变。
- 2026-09-24（宿主升级轮，用户裁决执行 `docs/plans/active/dsh-agent-team-0.1.7-rc.1-upgrade-plan.md`）：测试运行时基线 `fb2c4b9e698e30edb738bca4cf0618587db7d203`（0.1.5-rc.2）→ **`46a7f68b0922371ce7144b668b90e377d8e799f4`**（0.1.7-rc.1 官方发布点 = tag `dsh-v0.1.7-rc.1`）。test-use 检出迁移（`git fetch --tags origin` + `git checkout --detach`；对象本地已有——references 仓 2026-09-24 stable-2 轮已引入 0.1.7 系列对象，无网络依赖）；`pnpm install --ignore-scripts` + `DSH_CLIENT_COMMIT_HASH=46a7f68b09 node scripts/build.ts` 重建（勘误 2026-09-28：0.1.7 的 build.ts 须经 `pnpm run` 调用，见 §2；本历史段落命令表述按当时记录保留）；`tests/paths.mjs` pin 与 AGENTS.md 基线行同步更新。0.1.7 与 0.1.5 的 breaking surface（agent preset 声明模型 / `agent/created` 串行异步 / session log V4 / client multi-instance / MCP SDK v2 / spill token budget / plugin version compat check）按升级计划 U2–U6 逐项适配；本轮范围不含 session-resume/restart（POST-UPGRADE FOLLOW-UP）。端口策略与稳定实例红线不变。
- 2026-10-03（0.2.0-rc.2 宿主升级轮，用户指令：两个插件的 0.2.0-rc.2 版本维护，交付到独立 draft PR，不 merge）：测试运行时基线 `46a7f68b0922371ce7144b668b90e377d8e799f4`（0.1.7-rc.1）→ **`639ed015397290b3745d163aafe02ffee4aa3f84`**（0.2.0-rc.2 = fork 分支 `stable-3-0.2.0-rc.2` tip，来源 upstream `release(dsh): 0.2.0-rc.2` + PR #5479；fork 无 `dsh-v0.2.0-rc.2` tag）。本轮在**新 worktree** `.worktrees/dsh-020rc2-upgrade`（branch `task/dsh-020rc2-upgrade-20261003` @ `6b2f401b…`）内新建独立 pristine checkout（旧根与其 0.1.7 世界留原样，不迁移不覆盖）；`git clone --local --no-hardlinks` 自只读 baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` + `checkout --detach` + `pnpm install --ignore-scripts --frozen-lockfile`（porcelain 前后均空）+ `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build`。`tests/paths.mjs` pin 与 AGENTS.md 基线行同步更新，并新增 `DSH_BASELINE_VERSION` 作为版本字符串单一来源；`pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 改为**由 lock 派生**的 0.2.0-rc.2 完整集合（281 条，含 `@deepseek-ai/dsh` 本体，替换旧 hand-curated 80 条），并按 pnpm strict dep-builds 显式 deny 五个新入站的带 lifecycle-script 依赖（`@deepseek-ai/dsh-subprocess-local`/`@google/genai`/`koffi`/`node-pty`/`protobufjs` = false，沿 esbuild 先例）。全部 real-host kit 的宿主基线 pin 一并改为读 `tests/paths.mjs`（此前 9 个 kit 硬编码 `46a7f68b09`/`fb2c4b9e69`，1 个 kit 内联比较）。§4.2 的 characterization fixture/CI 按用户指令留在 `fb2c4b9e69` 作 archived/manual，不重录不重跑。端口策略与稳定实例红线不变。
- 2026-10-26（u7-w0，用户裁决，原文）：「当前机器应该没有太多会占用端口的进程。你可以尝试 3181-3199端口族；如果仍不够用，目前较大的端口区段（如13000甚至更大）应该都还是空置的」。裁决时实测：3180–3199 除 :3080（稳定实例，在一切测试段之外）外无监听，13000–13019 无监听；u7-w0 绑定前复测（`ss -ltn`，evidence `dev/agent-workflow/evidence/u7-w0-20261026/port-probe-pre.txt`）：3180–3199、3491–3500、13000–13099 全空，本机临时端口段 32768–60999 与各段不相交。`TEST_PORT_RANGES` 放宽为 3180-3199 / 3491-3500 / 13000-13099（上段有界 100 口：够六条并行 family lane 多 World 使用，失控租用者仍会很快耗尽并 fail-closed）；`STABLE_INSTANCE_PORT = 3080` 与 `isSanctionedTestPort` 对 3080 的拒绝**不变**；World 宿主租用不含 3180（原排除保留）。旧 kit 自带的候选表不改（仍在旧段内工作）。稳定实例红线不变。

## 7. DSH_HOME 命名与清理协议（`tests/homes/`，2026-09-12 新增）

- **共享持久 home**：`.dsh-test` —— 既有 durable 行**保留、永不销毁**（d4/g5 harness 约定）。
- **临时世界**：`<line>-<UTC 时间戳>`（例 `rmr-rev7-20260912T03-00-00Z`）；一世界一目录；teardown 时删除，**除非**作为证据保留（保留则必须在任务 evidence 目录登记路径）。
- **长生命周期任务 home**：`.dsh-test-<task>`（例 `.dsh-test-p8s3`）；新鲜性（FRESH/fail-closed）规则属于消费它的 harness 自身。
- **锁文件**与 home 同处：`<home>.lock`。
- 历史 home（旧布局 `references/.dsh-test*`，若存在）**不迁移**；新工作一律使用 `tests/homes/`。
- 一切 home 均含 launch token 与世界状态：**永不提交**；删除世界属于影响面操作，须在 evidence 留痕。

## 8. 历史证据存储与 worktree 布局（U3，2026-10-25 新增）

- **已迁出的历史证据**：PR #366 将 20,148 个历史 tracked evidence 文件（约 498 MiB）`git rm` 出当前树（不改写历史）。索引 = `dev/agent-workflow/evidence/RELOCATED-MANIFEST.tsv`（tracked）；内容存于**本地临时**内容寻址库 `.artifacts/evidence/blobs/`（gitignored，与工作区同盘；用户裁决：临时方案，现存储体系后续废弃）。工具 = `node scripts/evidence-store.mjs verify | restore <path>… [--from-git] | ingest --from-commit <sha>`；本地库丢失时用 `--from-git` / `ingest --from-commit 95fbe95cf` 从 git 历史恢复。代码/CI 运行时读取的证据、文档链接目标与全部 evidence `*.md` 仍 tracked（keep-set，见 manifest 头注）。
- **新 worktree 默认全量 checkout**：仓库曾在根 `.git/config.worktree` 启用 sparse-checkout，`git worktree add` 会继承 `.git/info/sparse-checkout` 模板并静默隐藏 manifest 等文件（U3 实测）。2026-10-25 起根 checkout 已 `git sparse-checkout disable`；如遇继承，在新 worktree 内执行 `git sparse-checkout disable`。需要稀疏时须显式声明并在 evidence 登记。
- **空间纪律**：一任务一 worktree，合并即 `git worktree remove`；临时文件/日志放任务 evidence 或 `.artifacts/tmp/`，不得散落在 `.worktrees/` 根；`tests/homes/` 世界按 §7 用完即删。2026-10-25 U3 收口后实测：worktree 50→1（PR #360 头），df 可用 31 GiB→59 GiB。

## 9. 原生沙箱资产：gitignored 缺口、供给命令与预检裁决律（u7-sbx，2026-10-28 新增）

**缺陷（实测，非推测）**：宿主的 Linux 沙箱启动器由运行时 checkout 内 `native/system/packages/entry/lib/index.js` 解析——`launcherPath()` → 平台包 `@deepseek-ai/node-addon-system-<platform>-<arch>` 的 `bin/landlock-run`，`probe()` 以 `--probe` 真跑该二进制并返回 `full` / `partial` / `unusable`。而 `native/system/.gitignore` 的 `packages/*/bin/`（与 `packages/*/lib/`）使这些**原生资产从不进 git**：§1 记录的 fresh-worktree 流程（`git clone --local --no-hardlinks` + `checkout --detach`）得到的树里 `bin/`、`bin/glibc/` 目录在而**二进制缺失**（`git check-ignore -v` 指回该规则；宿主 `flock` addon 同理）。本机 `bwrap` 无法运行（非特权 user namespace 被拒），Landlock 是唯一可用后端，故缺启动器＝原生约束整体失效：宿主 fail closed 报 `sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host`。

| 检查 | 主 checkout | 新建 worktree（未供给） |
| --- | --- | --- |
| `import('…/entry/lib/index.js').probe()` | `partial` | **`unusable`** |
| `bin/landlock-run` · `bin/glibc/system.node` | 存在 | 目录在、文件缺失 |

**为什么这属于测试基础设施**：PR #427 的 Jobs Bridge 记录在 `u74a:native-ctl-unaffected` 上 `overall: FAIL` 并被归因于"宿主限制"，而同一条腿 2026-10-26 真实 PASS 且记录 `landlock-run: partial enforcement (older Landlock ABI)`（evidence `dev/agent-workflow/evidence/u7-4a-jobs-producer-20261026/logs/u5u74a-20261026T11-57-55Z/u74a-main-4.u74a-evidence.json`）。环境/供给缺口被当作产品缺陷写进了 gate 记录；本节使两者不再可混淆。

**供给命令（本地复制、零网络、零源树写入）**：

```bash
# 运行时 checkout 已在位（detached @ 基线）之后：
node tests/world-factory/provision-host-sandbox.mjs              # 预检 + 按需供给
node tests/world-factory/provision-host-sandbox.mjs --check      # 只报告，不写
node tests/world-factory/provision-host-sandbox.mjs --manifest   # 打印 pin
# exit 0 = 后端可用 · 1 = 仍 unusable（环境态，套件记 ENV_BLOCK）· 2 = fail-closed（摘要/manifest 不符）
# 三个出口码对**所有**入口（含 --manifest/--check）一致：manifest 读不到/不合 schema 亦为 exit 2（typed FAIL-CLOSED 打印），绝不以未捕获异常退出 1（2026-10-28 review round 1 修 --manifest 的路径拼接缺陷后由 T18 锁死）。
```

源树默认 = **主 Team checkout 自身**的 `tests/deepseek-harness-test-use`；覆盖 = 环境变量 `DSH_TEAM_SANDBOX_ASSET_SOURCE=<本地树>`（唯一覆盖点；关闭自动供给 = `DSH_TEAM_SANDBOX_ASSET_PROVISION=0`）。**源树 containment（2026-10-28 review round 1 起为硬性规则）**：解析源树会 **import 该树的 entry module**（launcher 路径只经宿主自身解析，见下），故源路径＝选择执行谁的代码：环境变量给出的路径必须是**已存在的目录**，且其 **realpath 留在可信根内**——调用方指定的 Team repo root（含 task worktree 情形下的主 checkout 运行时树）+ 本文 §6 记录的只读共享 baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness`（**唯一**允许的本仓之外取值）。符号链接逃逸、`..` 逃逸、目录之外的路径一律以 typed code 拒绝（`SOURCE_TREE_MISSING` / `SOURCE_TREE_NOT_A_DIRECTORY` / `SOURCE_TREE_OUTSIDE_ALLOWED_ROOTS`），且属**供给链事件**（fatal，抛出并拒绝启动 Host），不是 `unusable` 环境态。WorldFactory 在**第一次 host start 之前**执行同一预检（`tests/world-factory/lib/host-sandbox-assets.mjs`），把 backend 判定、启动器摘要与供给 provenance 绑定进 RUN record 的 `bindings.sandboxPreflight` / `bindings.nativeConfinementBackend`；`RUN-SUMMARY` 行在后端不可用时追加 `nativeBackend=unusable` 披露。

**Pinned 摘要与 provenance**：`tests/world-factory/lib/host-sandbox-assets-manifest.json`（tracked），键 = `tests/paths.mjs` 的 `DSH_BASELINE_VERSION@TEST_USE_BASELINE_SHA`，平台 `linux-x64`（`libc: glibc`，与宿主 `entry/src/flock.ts` 的 libc 选择一致）：

| 文件（平台包相对路径） | sha256 | bytes | 出处 |
| --- | --- | --- | --- |
| `bin/landlock-run`（launcher） | `a752bc72f111fcc573c3e61fb90fa544541dac0ca498d2e279e1630d7c659b31` | 38552 | 主 checkout 运行时树 @ `639ed01539`（porcelain 空）实测；与官方 `@deepseek-ai/node-addon-system-linux-x64` tarball 同字节（该包 `prebuilds.json` 列明同一路径） |
| `bin/glibc/system.node` | `54a9c25c05186c17520f6b7a5ced5f005752c08044c3eb76524cd517287600bc` | 17360 | 同上 |

复核：`sha256sum tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run`。**供给纪律**（由 `tests/world-factory/host-sandbox-assets.test.mjs` 22 条 C1 锁死，含 mutation 证据；2026-10-28 review round 1 增 T18–T22）：先校验后落地——源字节先对表、暂存文件再对表、发布后再对表，任一步不符即删除该副本并以 typed error 命名期望/实际摘要，摘要不符的二进制永不到达宿主 exec 的路径；**写范围与模式也是 pin 的一部分，且在任何文件系统改动之前决定**：manifest 声明的每个相对路径必须是纯相对、无 `.`/`..` 段、不绝对，并落在该平台包 `bin/` 子树内（`MANIFEST_PATH_UNSAFE` 在任何 mkdir/copy/rename 之前拒绝，实测零残留），发布文件的**实际 mode 必须等于 pin 的 mode**（`0o755` 由 manifest pin，非代码硬编码；漂移 → 删除该文件并以 `PUBLISHED_MODE_MISMATCH` 关闭，pin 本身不可解析 → `MANIFEST_MODE_INVALID`）；**不是自己写的字节永不覆盖或删除**（目的地已存在但不符 → `DESTINATION_DIGEST_MISMATCH`，原样留给人类）；未在 manifest pin 的基线 / 平台 / libc 变体一律 fail closed，绝不"顺手复制"；launcher 路径只经宿主自身 `launcherPath()` 解析，不硬编码。**回滚**：删除这两个 gitignored 文件即回到未供给态（实测供给前后 `git status --porcelain` 皆为空）。

**裁决律（verdict fidelity，硬性）**：

1. 原生（非 governed）约束腿——至少 `u74a:native-ctl-unaffected` 与 ARC-D 的 `arcd:ci03-native-parity`——判 `ENV_BLOCK` 的**唯一**通路是**合取**：真实预检记录的 probe 判定为 `unusable` **且** 该腿观测到宿主 typed 拒绝信号（`no sandbox backend is usable on this host` / `SANDBOX_UNAVAILABLE` / `(sandbox-unavailable)` / `SandboxUnavailableError`）。"真实"＝**身份**而非形状（2026-10-28 review round 1 起强制）：该对象必须由本模块 `preflightHostSandbox()` 在本进程产出（模块私有 `WeakSet` 品牌）并满足形状（`schema=u7-sbx-sandbox-preflight/1`、`probed:true`、`backend` 为字符串）；品牌不随 JSON 序列化存活，故 RUN record 里的记录是其绑定证据，判定时传的是**测得的那一个对象**。
2. 合取不成立即维持原判定：功能性失败仍是 **FAIL**（unusable 单独存在不洗白失败；typed 消息单独存在也不成立；手工伪造的 preflight 对象不成立）。ARC-D 磁盘法不受影响：效果文件存在但字节不是本轮 marker → 永远 FAIL。
3. 环境状态**永不计入 PASS**：`overallVerdict` 的 `VERDICT_SEVERITY` 顺序本轮未改，`SKIP/REFUSED/ENV_BLOCK` 仍不是 PASS，ENV_BLOCK 仍使 `overall != PASS` 且退出码 1。
4. 摘要不符是供给链事件不是环境态：预检**抛出**并拒绝启动 Host，而非记成 `unusable` 继续跑。
5. 套件不得为变绿放宽沙箱、替换原生工具或 patch 宿主（CORE PATCH BUDGET = 0）。

### 9.1 第二条传输：已发布的 pin 包（2026-11-16 owner 裁决）

**缺陷**：hosted census runner 的**自身构建**产出的 `bin/glibc/system.node` 与上表 pin 不同（实测
`dfa6d586…` vs `54a9c25c…`，census 作业输出 `M7A-STEP verdict=DISCLOSED_REFUSAL reason=HOST_ASSET_UNPROVISIONABLE arms=0`），
而本地复制传输要求源树就是"那一台机器"的字节，runner 没有这样的源树。此前 M7-A 步骤靠
`M7A_ALLOW_UNPROVISIONABLE_HOST=1` 把这个缺口记成**具名拒绝**，等于 L2 上真实安全链从未验证。

**裁决**：固定发布产物是标准，runner 的构建不是。**不移动上表 pin**；改为从已发布的
`@deepseek-ai/node-addon-system-linux-x64@0.1.2` 取 tarball（25758 B，sha256 `77fb771b…`，
registry `dist.integrity` `sha512-S2aPVHvY…`），验证后安装**同一组 pin 字节**。包内
`bin/glibc/system.node` = `54a9c25c…`（17360 B）、`bin/landlock-run` = `a752bc72…`（38552 B）；
包内另有 `bin/musl/system.node`（17960 B），故 manifest 新增 `siblings` 把它一并 pin 住，
"`bin/` 下多余文件" = 既不在 `files` 也不在 `siblings` 的文件（整棵 `bin/` 仍被完整解释）。

**命令**（tarball only；不 `pnpm install` 该包、不加仓库依赖、不 patch 宿主）：

```bash
node scripts/provision-host-assets.mjs --from-package @deepseek-ai/node-addon-system-linux-x64@0.1.2
# exit 0 → stdout 一行 HOST-ASSETS-PROVISIONED package=… version=… tarballSha256=… distIntegrity=… files=… host=… manifestDigest=… utc=… receipt=…
# exit 1 → stderr 一行 HOST-ASSETS-REFUSED code=… detail=…
```

**顺序即拒绝顺序**：精确版本（`PACKAGE_SPEC_NOT_EXACT` / `PACKAGE_VERSION_UNPINNED` / `PACKAGE_SPEC_INVALID`，
全部在网络前）→ 目标符号链接（`DESTINATION_IS_SYMLINK`）与目标形状（`DESTINATION_NOT_REGULAR_FILE`：FIFO/socket/设备/目录/硬链接在**第一次读之前** `lstat` 拒绝，见 memo §7.1；本地复制传输共用同一律），两者都在任何写之前→ metadata
（`REGISTRY_METADATA_UNAVAILABLE` / `REGISTRY_INTEGRITY_MISSING` / `REGISTRY_INTEGRITY_UNKNOWN` /
`REGISTRY_NAME_MISMATCH` / `REGISTRY_VERSION_MISMATCH`）→ tarball（`TARBALL_INTEGRITY_MISMATCH` 对 registry
`dist.integrity`，再 `TARBALL_DIGEST_MISMATCH` / `TARBALL_LENGTH_MISMATCH` 对提交的 `tarballSha256` /
`tarballBytes`）→ 解包（`PACKAGE_ARCHIVE_PATH_UNSAFE` / `PACKAGE_ARCHIVE_ENTRY_UNSAFE` / `PACKAGE_EXTRACT_FAILED`）→
逐文件（`PACKAGE_EXTRA_BIN_FILE` / `PACKAGE_FILE_MISSING` / `PACKAGE_FILE_LENGTH_MISMATCH` /
`PACKAGE_FILE_DIGEST_MISMATCH`）→ 暂存 + chmod 到 pin 的 mode + rename + 复读 digest/mode →
receipt（`u7-sbx-host-asset-receipt/1`，含 package spec、tarball sha256、`distIntegrity`、逐文件 sha256、
host sha、UTC、**manifest digest**）。任一步失败 → 回滚、零残留、typed error。`packages.files` 必须与
`entries.files` 深度相等，否则 `PACKAGE_PIN_DIVERGES_FROM_HOST_PIN`——发布包不能定义第二标准。

**本地复制传输不变**：仍拒绝 `DESTINATION_DIGEST_MISMATCH`（不覆盖别人的字节）；**package transport 有意
替换** runner 构建的字节，这正是它的用途（失败时回滚备份）。测试：`tests/world-factory/host-sandbox-assets.test.mjs`
T28–T39（真实 tar.gz fixture + 注入 fetcher/extractor，离线；T29 正向、T30–T37 拒绝矩阵、T38 CI 接线、
T39 CLI 契约）。**CI**：`.github/workflows/census-runtime.yml` 在 M7-A 之前新增该步骤，并**删除**
`M7A_ALLOW_UNPROVISIONABLE_HOST`（拒绝码路径保留在 `lib/m7a-step-verdict.mjs`，默认关闭；T38 逐 workflow
断言没有 workflow 设置它 → CI 上不可达，任何拒绝都是红）；`dev/ci/eb3-ci-manifest.json` 的 `ci-census`
新增同 argv leg（whole-argv 纪律与 M7-A 腿相同）。设计正本：
`docs/plans/memo/host-assets-20261116/README.md`。

**仍未证明**：进程/PTY/网络观测面（M7-B）；registry 可用性（离线 runner 会 red，有意 fail closed）；
发布字节能否由源码重建（本传输只保证"发布字节 = pin 字节"）。**本机主 checkout 的 `system.node`
当前仍是 `75450f92…`（17352 B），与 pin 不同**——本 PR 不修改被 gitignore 的运行时树；需要时用上面的
供给命令（`--runtime-tree <树>`）把它修成 pin 字节。

## 10. Host 启动授权：`DEV-LIVE` 与 `CANDIDATE-C2`（2026-11-09 owner 裁决）

本节把 `docs/ROUTER_RULES.md` §0.1 第 4 条落到测试基础设施上。**它只改启动授权，不改隔离、
证据与验收**：正文 §1–§9 的端口、`DSH_HOME`、干净树、原生沙箱资产与 verdict 规则全部继续有效。

### 10.1 两类授权，互不通用

| | **DEV-LIVE**（开发启动） | **CANDIDATE-C2**（冻结候选验收） |
|---|---|---|
| 授权形态 | `scope: "dev-live"` 的 grant 行：`{grantId, scope, grantedBy, face, world}` | 每次运行一条 grant：`{grantId, maxStarts, grantedBy, boundCommit}`（无 `scope` 字段的旧行默认此类型） |
| 谁授权 | Capability Implementer **自授权**，前提是 owner 已给该面一个 scope authorisation | owner / Integration Owner 按候选冻结发放 |
| 次数 | **无固定累计上限**；同一授权可反复开新 lease | `maxStarts`（含 1 行预登记）：仍是每次运行固定、失败不结转 |
| 绑定 | 绑 **face + 隔离 test World**；运行时的 commit 记入 `headCommit`，不要求等于签发时 commit | 绑 **不可变 SHA**（`boundCommit`）+ Authority + Host + Oracle |
| 并发 | 每台机器最多 **2** 个 dev Host（`DEV_LIVE_SLOT_LIMIT`） | 由 Integration Owner 调度 |
| 记录类别 | `recordClass: "DEV-LIVE"`；**永不**能产出 `V@B=yes` | `recordClass: "CANDIDATE-C2"`；仍走既有 C2 全部检查 |
| 仍禁止 | `:3080` 稳定实例、真实外部系统、共享 Authority 指针、release candidate | 同左 |

**scope 不互跨**：dev-live grant 交给候选门 ⇒ `GRANT_SCOPE_MISMATCH`；候选 grant 交给开发门 ⇒
同样拒绝；记录类别与 scope 必须一致（`RECORD_CLASS_MISMATCH`）。候选路径的
`maxStarts` / `boundCommit` / 预登记 / 预算位置检查**一个都没有放宽**。

### 10.2 每次 dev-live start 仍须登记的内容

账本（与候选同一个 `run-record.mjs` 写入器、同一个 JSONL）逐行带 `recordClass`：

1. `budget-intent` — `grantId` / `grantedBy` / `face` / `world` / `headCommit`（版本）/ `plannedStarts`；
2. 启动行 — harness 在 **spawn 之前**写入的 `world` / `phase` / `suite`（环境 = 该隔离 World 的
   `DSH_HOME` 与 port lease，仍由 WorldFactory 记录）；
3. `dev-live-outcome` — `overall` / `cases` / `teardown`（World teardown receipt），由
   `lease.finish({...})` 写入并同时释放并发槽。

RUN record 另带 `recordClass` 与 `candidateClaimEligibility`（机器可读的“本记录能否支撑候选断言”）。

### 10.3 隔离、teardown、证据（不变）

- 每个 dev Host 用**自己的** `tests/homes/<world>`、自己的 workspace、自己的日志；
- 端口仍从 `tests/paths.mjs` 的测试段租用，`3080` 永不租给 World；
- teardown 仍按**身份**（pid + startedAt）杀进程、释放 lease、删 home；
- 崩溃恢复：并发槽按 `pidAlive` 判 stale 并回收（死 pid 立即回收；不可解析文件 >60 s 视为残留；
  4 h TTL 仅作兜底）；
- 独立 Reviewer、CI 与 Q7 不变。

### 10.4 重试纪律（取代总次数上限）

同一失败原因且**没有新的诊断信息**连续 **3 次** ⇒ 停止盲试，按 `ROUTER_RULES.md` §5 升级并写清：
失败原因、已排除的假设、下一条需要的新事实。**不再**用“总共只能 N 次启动”的算术。

### 10.5 一页操作手册

实现者按 `docs/DEV-LIVE-OPERATOR-GUIDE.md` 执行（如何自授权、写什么、禁止什么、3 次后如何升级）。

## 11. 第二台 pinned Host（next host，0.2.2-rc.5）：pin、物化、原生资产与验收通道（2026-11-16）

**目的**：legacy Host（`tests/deepseek-harness-test-use`，0.2.0-rc.2 @ `639ed01539`）保持不动，另立
一台**独立**的 pinned Host 用于验证 UTE 设计依赖的 native API。两台 Host 的 pin、树、`DSH_HOME`、
端口族、构建产物、原生资产与证据**全部隔离**；唯一来源仍是 `tests/paths.mjs`（legacy 常量
`DSH_BASELINE_VERSION` / `TEST_USE_BASELINE_SHA` / `CLIENT_COMMIT_HASH` / `TEST_USE_REL` **不移动**，
next host 的 pin 在文件末尾的 `NEXT_HOST` 块）。

### 11.1 Pin（2026-11-16 复核）

| 字段 | 值 | 复核方式 |
| --- | --- | --- |
| version | `0.2.2-rc.5` | `tests/paths.mjs#NEXT_HOST.version` |
| tag | `dsh-v0.2.2-rc.5`（**轻量 tag**，无 `^{}` peel 行，ref 即 commit） | `git ls-remote --tags https://github.com/deepseek-ai/deepseek-harness.git 'dsh-v0.2.2*'` |
| commit | `9c2670d3bce5275e0d1610272958121af87787bb` | 同上 + `git -C tests/deepseek-harness-next rev-parse HEAD` |
| remote | **upstream** `https://github.com/deepseek-ai/deepseek-harness.git` | Team fork **不带** `dsh-v0.2.2*` tag（ls-remote 为空） |
| 原生资产包 | `@deepseek-ai/node-addon-system-linux-x64@0.1.2` | 该包**只发布过 0.1.2**（无 0.2.2 资产发布）；rc.5 树自身声明 0.1.2 |

证据：`dev/agent-workflow/evidence/host-next-20261116/pin-verification.txt`。**不要**用 fork、旧分支名或
"最新的 0.2.2" 代替，也不要因 registry 没有 0.2.2 资产包而改用本地构建字节（见 11.3）。

### 11.2 物化 / 构建（gitignored，可复现）

**CI / 一条命令（2026-11-19 起，`ci-census` 用它）**：`node scripts/provision-next-host.mjs --materialize`
——从 upstream 解析 tag 并**先**断言 `refs/tags/dsh-v0.2.2-rc.5` 的 commit 就是 pin（`TAG_DRIFT`），再
clone/fetch 该 tag，随后断言 HEAD（`HEAD_DRIFT`）、树自身 `version`（`VERSION_DRIFT`）、用**树自己 pin 的**
包管理器（读 `package.json#packageManager`，本树 `pnpm@11.28.5`，不是本仓的 11.7.0）install + build，构建后
**再**断言 HEAD 与 `git status --porcelain` 为空（`TREE_DIRTY`）。任何一步失败 = `NEXT-HOST-REFUSED
code=…` + exit 1，绝不 skip。`--verify` 是同一套断言的无网络/零写入版本；`--assets` 见 §11.3。
下面这条手工链是 2026-11-16 的实测原始记录（**实测数字以它为准**），两步等价：

```bash
# 1) clone（浅克隆、在 tag 上 detached；目录 gitignored）
git clone --branch dsh-v0.2.2-rc.5 --depth 1 \
  https://github.com/deepseek-ai/deepseek-harness.git tests/deepseek-harness-next
# 2) 安装：该树 pin 的包管理器是 pnpm@11.28.5（legacy 树是 11.7.0），故按树取版本
npm install --prefix .next-tools pnpm@11.28.5        # 或任意等价的本地安装方式
node .next-tools/node_modules/pnpm/bin/pnpm.cjs install --ignore-scripts --frozen-lockfile \
  --store-dir "$PWD/.next-pnpm-store"
# 3) 构建（与 §2 同一套确定性 env 约定；commit hash 用 NEXT_HOST.shortSha）
DSH_CLIENT_COMMIT_HASH=9c2670d3bc ESBUILD_WORKER_THREADS=1 \
  node .next-tools/node_modules/pnpm/bin/pnpm.cjs run build
```

实测（2026-11-16，本机）：install 15.5 s · build 130.16 s、`10 passed`、`recorded 371 client
artifact(s)`；`apps/cli/lib/bin.js` 与 `native/system/packages/entry/lib/index.js` 为构建产物。
证据：`.../materialize-build.txt`。**不要**在宿主的 TS 源码上跑 `tsc`/`tsx` 直连：启动一律走构建产物
入口（§2 的同一理由）。

### 11.3 原生沙箱资产：同一 pin 的已发布包（拒绝本地构建字节）

rc.5 树的 `native/system/packages/{entry,linux-x64}/package.json` 都声明 version `0.1.2`，且其
package 清单与 C 源（`entry/src/*.c`）与 0.2.0-rc.2 树 **逐字节相同**（`diff -rq` 空）——所以已发布的
0.1.2 tarball 就是这台 Host 的**同一个固定产物**，其 per-file sha256 与已提交的 pin 相同：

```bash
node scripts/provision-next-host.mjs --assets     # CI 用这条；等价于下面那条（同一共享 transport）
node scripts/provision-host-assets.mjs --from-package --host next \
  --runtime-tree tests/deepseek-harness-next
# exit 0 → HOST-ASSETS-PROVISIONED package=… version=0.1.2 tarballSha256=77fb771b… hostBaseline=next host=9c2670d3… receipt=…
# exit 1 → HOST-ASSETS-REFUSED code=…（精确版本、registry dist.integrity、逐文件 length+sha256+mode、0o755、回滚、零残留——语义与 §9/§9.1 完全相同）
```

**实测漂移（必须拒绝的那一类）**：`pnpm run build` 在本机产出的 `bin/glibc/system.node` 是
`75450f92…`（17352 B），**不是** pin `54a9c25c…`（17360 B）；`bin/landlock-run` 根本不由该构建产出。
供给后两者变为 pin 字节（`sha256sum` + `stat -c %a` = `0o755`），receipt 见
`.../provisioning-receipt.txt`。**不得**把本地构建的 addon 当作 pinned host 验收。

### 11.4 隔离（与 legacy 世界零共享可变状态）

- 树：`tests/deepseek-harness-next/`（gitignored；`tests/deepseek-harness-test-use/` 不动）。
- `DSH_HOME`：`tests/homes/<world>-next`（`nextHostHomeDir()`），永不与 legacy 的 `<world>` 同名；
  home 内 token/会话永不提交，teardown 删除并在证据登记。
- 端口：**按代际分区**（RULING，UTE-Prep，2026-11-16）：legacy host 只租 **3181-3199**（`HOST_PORT_BANDS`），
  第二台 pinned host 只租 **13000-13049**（`NEXT_HOST.portBands`），两组**不相交**（13000-13049 不再属于
  legacy 的 fall-through 段；mock 仍 3491-3500 / 13050-13099）。`3080` 永不使用。该分区是**代码断言**
  （`tests/next-host` 的 `assertGenerationBandsDisjoint()` + boot 端口 ∈ 13000-13049 ∧ ∉ legacy 段；
  `tests/world-factory/world-factory.test.mjs` 同步断言），不是靠"先探空闲端口"的运气。
- 构建产物 / pnpm store / 日志：worktree 内各自独立；legacy 的构建与 node_modules 不参与。

### 11.5 验收通道（fail-loud，无 skip）

```bash
node --test 'tests/next-host/*.test.mjs'   # 两条 suite：boot + native API smoke（Node 24 不接受目录参数）
```

- `tests/next-host/boot.test.mjs`：用既有 `packages/tools/harness/mock-deepseek.mjs` 脚本模型
  （`DEEPSEEK_BASE_URL` 上线）真实启动 `apps/cli/lib/bin.js web`，记录 boot marker 行与
  spawn→marker 墙钟；随后经公开 RPC（`session/create` + `session/prompt`）让该进程服务一个 session，
  并核对 mock 侧的模型请求与 Host 自己写的 `sessions/**.jsonl.zstd`。
- `tests/next-host/native-api.test.mjs`：只 import 宿主**已发布包入口**（`@deepseek-ai/dsh-tools`、
  `@deepseek-ai/dsh-tool-executor-*`、`@deepseek-ai/dsh-agent-loop-testkit`、`@deepseek-ai/dsh-tool-testkit`、
  `@deepseek-ai/dsh-ptc-runtime` 等；绝不 import 私有 `src/`），断言：`ToolsService.resolve()` →
  `ResolvedToolSet`；`ToolExecutor` 被选中且工具体真的执行（可观测副作用）；pipeline 阶段顺序
  `pre-execute → execute → post-execute → result`；PTC `run_code` 的嵌套调用到达**真实内层 executor**
  （session 记录 `tool/ptc-dispatch-start` + `tool/ptc-dispatch`）；取消语义（mid-flight 取消 =
  `ABORTED`，dispatch 前取消 = `ABORTED_BEFORE_DISPATCH`，工具忽略 abort 也不能把取消变成成功，
  `tools/result` 仍通知该失败）。
- **fail-loud，且 2026-11-19 起在 CI 里执行**：树缺失/未构建/HEAD 漂移/版本漂移、原生资产缺失或
  sha256/length/mode 不符 → 直接 throw（`host-next-lib.mjs` 的 `NextHostMissingError`，带 `code`：
  `TREE_MISSING` / `NOT_BUILT` / `NOT_A_GIT_CHECKOUT` / `HEAD_DRIFT` / `VERSION_DRIFT` /
  `VERSION_UNREADABLE` / `PIN_INVALID` / `ASSET_MISSING` / `ASSET_DIGEST_DRIFT` /
  `ASSET_BYTES_DRIFT` / `ASSET_MODE_DRIFT` / `MODULE_UNRESOLVED`），**没有** skip 分支。
  **此前**该通道不进 CI，理由是"census runner 没有这台树的构建"——那句话在 2026-11-19 被改成
  "runner 负责物化它"：`ci-census`（唯一已经获准 provision host 的 job）新增三条**已声明、不可 skip、
  能把层判红**的 leg（`dev/ci/eb3-ci-manifest.json`）：`--materialize` → `--assets` →
  `node --test … tests/next-host/{boot,native-api,provisioning-controls}.test.mjs`。缺失/漂移因此是
  **RED job**，不是 NOT_RUN；这是"不执行"与"执行后失败"的区别，也是本通道进 CI 的唯一理由。
  拒码不是 README 里的承诺：`tests/next-host/provisioning-controls.test.mjs` 用 fixture 逐码开火
  （正控证明这些拒码不是"永远拒绝"），13/13 在 4 s 内跑完，host-free。
  **端到端实测（2026-11-19，本机）**：`--materialize` 从空目录起（fresh clone → 树自己 pnpm 11.28.5 →
  install → build）**4 m 49 s**，tag/HEAD/version 全绿、构建后 porcelain 为空；该次构建产出的
  `bin/glibc/system.node` = `75450f92…`（17352 B，与 §11.3 记录的漂移一致）、`bin/landlock-run` 不存在；
  `--assets` 后两者变为 pin（`54a9c25c…`/17360 B、`a752bc72…`/38552 B、mode 0o755）；随后在**这棵新树**上
  跑完整通道 19/19（6 条 lane + 13 条拒码控制）通过。证据 `dev/agent-workflow/evidence/nexthost-ci-20261119/`。
- **非执行通道必须可数，且现在少了 2 条**：两条 suite 曾同时在 `dev/ci/test-contracts.json#excludes`
  （不执行通道）里，`dev/ci/excluded-baseline.json` 记录路径 + reason + review ref，
  `--max-excluded N` 是计数闸（不在基线 → `EXCLUDED_NEW`，超上限 → `EXCLUDED_GREW`）。
  2026-11-19 两条 next-host suite 被 CI 真正执行，因此 2 条 exclude 行**被删除**、基线由工具重生成
  （`--write-excluded-baseline`，非手写），闸从 **9 → 7**；`--max-uncollected` **保持 41 不变**，
  因为这两条本来就是 **EXCLUDED 而不是 UNCOLLECTED**（用 `--json` 逐类计数实测，不是从总数假设）。
  于是 `tests/next-host/*` 现为 `DISCOVERED_AND_COLLECTED`，且不再出现在任何不执行清单里。

### 11.6 尚未证明（UNKNOWN）

- **hosted runner 的实网可达性**：本机实测（2026-11-19）`git ls-remote` upstream 的
  `refs/tags/dsh-v0.2.2-rc.5` = pin、`registry.npmjs.org` HTTP 200；但 runner 能否 clone upstream +
  装该树的 pnpm 依赖，只有第一次 hosted L2 才能给出答案。失败形态是**具名**的
  （`TAG_UNRESOLVABLE` / `CLONE_FAILED` / `PNPM_INSTALL_FAILED` / `INSTALL_FAILED` / `BUILD_FAILED`），
  不是静默 skip。
- **rc.5 的 boot 在 runner 上**（hosted kernel、无本机 WSL2 前提）未测：本机 6/6 通过（boot 2.0 s、
  服务一个 session、`modelRequests=2`），runner 上的第一次执行就是 L2 的 next-host leg。
- PTC 的**真实子进程 runtime**（`@deepseek-ai/dsh-ptc-runtime-node`）未接入 smoke：smoke 用宿主公开的
  `PtcRuntime` provider seam（与宿主自身 integration 测试同一写法）驱动嵌套 dispatch；真实 subprocess /
  sandbox 执行路径仍待一条独立 lane。
- 0.2.2-rc.5 上 legacy 的全部 census 腿未逐条重跑（本轮只证明 next-host 通道 + legacy `tinf-instruments`
  腿不变）。
- 发布字节能否由源码确定性重建（本通道只保证"发布字节 = pin 字节"）。
