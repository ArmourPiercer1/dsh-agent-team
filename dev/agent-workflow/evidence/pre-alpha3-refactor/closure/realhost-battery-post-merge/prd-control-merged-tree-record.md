# PR-D 40/40 control real-host gate — merged-tree record (closure battery, 2026-10-01)

## 状态行（用户裁决口径：control-plane 通过与 bash 侧效未验证分开记录，不得据前者称整 kit 全过）

**38 / 40 PASS（control-plane 语义全部在合并树验证）+ 2 / 40 FAIL（bash 侧效执行检查 — 宿主沙箱后端缺失，具体环境 blocker，非产品回归、非耗时问题）。整 kit 40/40 在本环境不可达成。** sandbox 未被禁用/弱化，未改任何安全配置，未做任何安装。

## 运行坐标（provenance）

- 命令：`node tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs`（tracked kit，未改）
- 日志：`realhost-battery-post-merge/battery-04-prd-control.log`（CMD-first + 完整 stdout + EXIT 末行 + HEAD + porcelain）
- HEAD：`59b619c6b9638ab10aebf7ef9e5f89107b7823c8`（closure head；产品树与合并后 master 字节一致，`post-merge-identity-proof.txt`）
- **产品 mergeSHA：`c19af1954239c6b3933e708fd9bdb0d50dbe1ea4`（merged master = 被测树）**
- 宿主：test-use `46a7f68b0922371ce7144b668b90e377d8e799f4`（0.1.7-rc.1，pristine；pre/post porcelain EMPTY）
- 端口：host 3182 / mock 3497（:3080 仅观测，未触碰；stable pre/post probe 在案）
- 证据目录：`dev/agent-workflow/evidence/pre-alpha3-refactor/pr-d/prd-control-2026-10-01T11-13-39/`（api-transcript.json / mock.log / summary.json / instances/ / git-pre / git-post / testuse-pre.json / testuse-post.json）

## PASS（38 项）— control-plane 语义在合并树验证

- C1 控制面（4 项）：member bash ask 创建**持久 leader-approval 请求（LEGACY shape**：instance subject 由 targetInstanceId 派生、无 executionCoupling 字段**）**，经 REMOTE ledger page 验证；leader 经 model-facing approval 工具（team_resolve_control）resolve allow（terminal `decided`，源自持久 decision fact）；durable facts `control-request-recorded` / `control-decision-recorded`（allow，decider = LEADER principal，model-tool 路径）/ `control-allow-consumed` 各恰一次；只读 team_domain.json 交叉核对一致。
- C2（远程 v4 双通道）：team.resolveControl ALLOW 的封闭 v4 成功信封（requestId + decision=allow + host 派生 HUMAN decider + scope）；DENY 同形（decision=deny + human decider）；两请求 terminal `decided`（源自持久 decision facts）；deny 后 guarded-lane 重试被 `decision-deny` 阻断（零 effect、零消费）。
- C3/C4 族：ask-lane 语义、one-shot 消费、deny 零 effect、abandon 级联（C4a worker turn post-disconnect abort cascade）等 —— 全部控制面/持久事实/边界检查通过（完整 38 项清单见 battery-04 日志 PASS 行）。
- H1 卫生：stable :3080/:3180 pre/post probe 一致（:3080 = 401 观测；:3180 = unreachable 记录）、test-use pre/post pristine（porcelain EMPTY）、宿主端口全部释放。

## FAIL（2 项）— bash 侧效执行（未验证）

1. `C1 FAIL — the execution PROCEEDED: the side-effect file exists with the marker (the one-shot allow was consumed by the guard) :: file=/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/tmp/.prd-gate/prd-control-2026-10-01T11-13-39/prd-c1-prd-control-2026-10-01T11-13-39.txt exists=false`
2. `C2 FAIL — the ALLOWED scope EXECUTED (one-shot allow consumed; side-effect file present) and the DENIED scope was BLOCKED (no consumption; side-effect file absent) :: c2aFile=false c2bFile=false`（c2b 的"absent"方向本身正确；FAIL 判据因 c2aFile=false 而整体不满足）

**精确 tool_result（mock.log 原文，worker 会话中 bash 调用的 tool_result，is_error=true）**：

> Error: sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host; refusing to run the command unconfined. Install bubblewrap or run a Landlock-enforcing kernel (Linux), ensure sandbox-exec is usable (macOS), or ensure the ACL restricted-token runner can start (Windows) — otherwise switch the consumer to danger-full-access.

来源：`prd-control-2026-10-01T11-13-39/mock.log`（worker 会话 `call-prd-g0d36xo0` 的 tool_result；同文件含完整的 bash 调用参数 = `echo prd-c1-… > …/tmp/.prd-gate/…/prd-c1-….txt && echo c1-executed`）。

## 根因（只读确认，无任何配置/安装动作）

1. 控制面完整：allow 被 guard 消费（`control-allow-consumed` 持久事实在案），执行释放到达宿主 bash 工具 —— **拒绝发生在 upstream 宿主沙箱层（DSH host 的 sandbox 组件），不是插件代码**。
2. 拒绝源：test-use `packages/sandbox/sandbox/lib/index.js` L256-261 `SandboxUnavailableError`（fail-closed 设计：requested confined mode + 无可用后端 → 拒绝 unconfined 执行）。
3. 后端探测（只读实测，**分阶段**精确记录 —— 权威分阶段探针 + 原始错误 + 退出码见同目录 `namespace-sandbox-diagnostics.md`）：
   - 内核构建/策略**允许**非特权 userns（CONFIG_USER_NS=y；`max_user_namespaces=2147483647`；`unprivileged_userns_clone=1`）；
   - **单独** `unshare -U true` → **EXIT=0（成功）**；
   - `unshare -U -m true`（CLONE_NEWUSER|CLONE_NEWNS 组合）→ **EXIT=1 EPERM（拒绝）**；
   - `unshare -U --map-root-user true`（userns 内 `/proc/self/uid_map` 写入）→ **EXIT=1 EPERM（拒绝）**；
   - `bwrap --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent --tmpfs /tmp true` → **EXIT=1**，bwrap 自身打印（bwrap 的泛化诊断文案，非内核原文）："bwrap: No permissions to create new namespace, likely because the kernel does not allow non- privileged user namespaces."；
   - 即被拒步骤 = **userns+mountns 组合** 与 **uid_map 写入**（容器运行时层对嵌套/映射的拦截），不是"userns 完全不可用"（单独 userns 成功）；
   - Landlock：`/boot/config-6.8.0-142-generic` 无 CONFIG_LANDLOCK_* 条目 = **未构建**；sandbox-exec/ACL-restricted-token 后端在本 Linux 环境不适用。
   结论（分阶段）：bwrap 受限沙箱后端在本容器**不可运行**（缺 userns 嵌套 + uid_map 能力），Landlock 未构建 ⇒ DSH 宿主沙箱包（upstream）无可用后端 ⇒ 宿主 bash 工具按 fail-closed 设计拒绝一切受限执行。
4. TEST_METHODS.md 只读核查：§5 沙箱约束 = "测试实例工作默认在 workspace-write 内完成，不发起升级请求"；**不存在**"为宿主 bash 沙箱后端缺失准备的已文档化安全启动方式" —— 即隔离 host 配置未"漏接"任何已文档化的安全路径；此缺失是宿主内核能力问题。
5. 因此按用户裁决口径：**不做** sandbox 禁用/弱化、不改安全配置、不安装。若未来要在具备 userns/Landlock 的宿主上补齐 40/40，具体动作 = 在该宿主运行同一 tracked kit（零改动）；本环境的 2 项侧效检查保持"未验证（环境 blocker）"。

## 对 DoD #20 的意义

- pr-d（#49 control 面积）= **PARTIAL**：38/40 控制面语义在合并树（产品 mergeSHA c19af195）实宿主验证；2 项 bash 侧效执行 = 环境 blocker（内核无 userns → 宿主沙箱后端不可用），具体技术 blocker、非耗时、非产品回归。
- 该 blocker 同样约束其他 kit 中**依赖宿主 bash 真实执行**的腿（已见实例：prf G6 的 300KB spill → artifact-read-granted 链 = 同因未验证；E.12 各腿不依赖宿主 bash 执行 —— 见其 keyed re-run 结果）。
