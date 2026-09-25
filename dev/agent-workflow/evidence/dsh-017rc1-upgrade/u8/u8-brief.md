# U8 执行简报 — pristine 0.1.7 real-host vertical

任务：`docs/plans/active/dsh-agent-team-0.1.7-rc.1-upgrade-plan.md` §11（U0–U7 已完成并 commit，
证据同目录：upstream-seams / baseline-canonical / dependency-diff / preset-migration / spill-migration /
client-sessions-migration / mcp-regression / static-gates）。U8 = 本轮最终 compatibility authority。

## 环境硬约束（TEST_METHODS.md，违反即无效）

- host 源码 = `tests/deepseek-harness-test-use`（pristine 0.1.7-rc.1 @ `46a7f68b09`）。**只读**：
  运行后 `git status --porcelain` 必须为空、HEAD 不变。
- **严禁** 触碰 :3080（稳定实例）与 :3180（当前 GUI）——只允许读探测且 pre==post。
- DSH_HOME = `tests/homes/u8-017rc1-<stamp>`（工作区内；§7 命名/清理协议；不入库）。
- 端口：host 3491（3491–3500 族首个空闲）、mock 3496、MCP mini 3497/3498/3499。
- host 启动链（§2 实测组合，勿改）：
  `DSH_HOME=<world> node <testuse>/apps/cli/lib/bin.js web --port 3491 --no-open`，cwd = `<world>/workspace`。
- 任何 `pnpm` 安装步骤（git-install）：`XDG_DATA_HOME=<world>/.xdg`（pnpm 11 SQLite store 必须可写、
  workspace-write 沙箱全局 store 只读——git-install-boot.mjs 先例）、`TMPDIR=<world>/tmp`。
- scratch 日志：执行期写 `/home/user/dsh-plugins/dsh-agent-team/.tmp-evidence/`（绝对路径，主 checkout 下）；轮次收口后 scratch 目录已删除，被证据引用的日志归档至 `../scratch-logs/`（§7 留痕）。

## 启动前置（主会话已排程，执行前必须复核）

test-use 正在完全重置（`git clean -fdx` + `pnpm install --ignore-scripts` + 构建），日志
`/home/user/dsh-plugins/dsh-agent-team/scratch-logs/dsh-017rc1-u8-reset.log`。开始 V0 前确认：
`BUILD_EXIT:0` + `apps/cli/lib/bin.js` 存在 + `packages/fs/fs-local/lib/index.js` 存在（a2c7 pinned lib）
+ porcelain 空 + HEAD `46a7f68b09`。若 BUILD_EXIT 非 0 → 停止并报告（不要自行改 upstream）。
（重置原因：checkout 残留了预 checkpoint 的另一代构建产物——孤儿 `packages/settings/settings-file/`
+ stale 根 `lib/types/`（typert 产物，引用 0.1.7 已移除的 SettingsProvider），导致构建失败；
完全清理后重建是唯一干净路径。）

## 0.1.7 新增行为（本轮必须验证/记录，来源 = 0.1.7 源码已核验）

1. **plugin version-compat check**（plan §11.2 点名）：`packages/boot/app-boot/src/plugin-compatibility.ts`
   `evaluatePluginCompatibility`——读插件 root manifest `peerDependencies` 中 `@deepseek-ai/dsh*` 项，
   `semver.satisfies(runtime, range, {includePrerelease:true})`；`workspace:^|~|*` 视为当前 runtime。
   不兼容 → 永不安装（in-place 回滚 `profiles/*/node_modules`，`packages/boot/plugin-manager/src/operations.ts:413-458`），
   CLI 给出精确豁免命令 `dsh plugin <profile> allow-version <pkg>@<ver> --dsh-version <exact> --accept-risk`
   （`apps/cli/src/plugin.ts`）。**本插件 root manifest `peerDependencies` 为空 → 该 check 直接通过**
   （`Object.hasOwn(manifest,'peerDependencies')===false` → undefined）。V-11.2 要捕获安装日志证明：
   无 `incompatible` 行、无需 allow-version、add exit 0。
2. **mcp-client reconnect supervisor**（U6 已核验）：默认 enabled，启动失败/断连自动重连 ≤10 次；
   `failOnStartupError` 只约束初始尝试。scoped serverName 注册（同 Agent 内重名 load 时 throw）。
3. **session log V4**（U3/§4 已核验）：`session.v4.jsonl.zstd` 命名；迁移链 v0→v4 已在上游。
4. **spill = token budget**（U4 已核验）：0.1.7 以 token 预算触发 spill（V6 必须用 token 预算触发，
   不再用旧 byte threshold；published `dsh-spill-policy` lib 有 stale `maxInlineBytes` quirk，见
   spill-migration.log 的 post-upgrade follow-up）。

## 执行序列

### 第 0 步 — git-install smoke（plan §11.2，先于一切 V）

模板 = `dev/agent-workflow/evidence/strict-read-core-spill/smoke/git-install-boot.mjs`（0.1.5 轮先例，
照其世界布局移植）：
1. 新 world；`git clone --bare --branch task/dsh-017rc1-upgrade <worktree> <world>/repo.git`；
2. 用构建好的 CLI（test-use `apps/cli/lib/bin.js`）：`dsh plugin add file:///<world>/repo.git#task/dsh-017rc1-upgrade`
   （pnpm git-dep 语义 = `github:` 等价，PBA 先例已验）；
3. 断言 S1（首次 add exit 0、无 allowBuilds、无 ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED、
   **无 0.1.7 compat 拒绝行**）、S2（`dsh.profile.bundles` 自动含 dsh-agent-team——CLI reconcile
   根 `dsh.bundle.patch` 的产物，非手写行）、S3（安装目录带齐 commit 的 install surface：
   `packages/runtime/dist/.../team-spill-local.js` + 根 `cordis.patch.yml` 的 spill 行）；
4. boot 断言 B1（`dsh web:` 标记、无 ERR_MODULE_NOT_FOUND）、B2（无 duplicate spillStore）、
   B3（无 token GET / → 401）。

### V0 — host boot（在 git-install world 上，与第 0 步 boot 合并即可）

host boot marker；HTTP unauth 401；dsh-agent-team host row active + client row active（实例日志
插件加载行 + profile patch 状态）；team-spill-local active + base spill-local disabled（日志 +
cordis patch 行）；无 duplicate service；无 ERR_MODULE_NOT_FOUND；无 pending required service
（0.1.7 有 `apps/cli/src/startup-diagnostics.ts`——如日志输出诊断，收录）。

### V1 — Ordinary DSH unaffected

普通 session（非 Team）：发普通消息（mock model 应答）→ 执行一个普通 tool（如 fs read）→ turn 结束。
验证插件未破坏普通 Agent loop。

### V2 — New Team

team.create（leader + 1 member，经 initialWork 或 API——参照 rc2 kit 的 `team.create -> open Root ->
admitInitialWork` 真实产品路径）；验证：Team projection 建立、member 创建、preset mount 成功、
persona 可见、workspace 正确、model selection 正确。

### V3 — Team tools

至少：`team_send_message`（或等价）、`report-progress`（或等价）、`assign-task`/delegate 核心工作路径。
验证 tool 调用退出、不重现 `team_send_message` 悬挂（历史缺陷回归点）。

### V4 — permission/capability

leader allowed tool；member allowed tool；member denied tool（显式静态 deny，provenance 可辨）；
strict-read 正常 workspace 内 read；workspace 外无 grant → deny。
（rc2 kit 的 S1/S2/S3 正是这些路径——`allow read subtree team` 静默放行 / `deny read subtree runtime`
显式 deny / `ask bash any` 持久 control request + 外部批准。）

### V5 — MCP initial grant + 三变体（U6 移交项，plan §9.2 宿主半边）

起 3 个 mini server：`packages/runtime/root-binding/harness/mini-mcp.mjs`
`startMiniMcpServer([3497], {tools:'single'})` / `([3498], {tools:'paginated'})` / `([3499], {tools:'none'})`。
Blueprint `capabilities.mcp` allow 三 serverName；Team 初始化（none 变体不得崩初始化——U6 unit 已证
apply resolve，此处证宿主面）；断言成员可见工具面 **恰为** `mcp__<single>__ping` +
`mcp__<paged>__alpha` + `mcp__<paged>__beta`（两页聚合）+ `mcp__<none>__*` 零个；实际调用一次
（任一，期望 `pong:<msg>` 或 `<name>:<msg>`）；同一 live Team 三 server 并发挂载稳定。
（模板：`tests/kits/mcp-initial-grant-smoke/mcp-initial-grant-smoke.mjs`——0.1.5 轮，注意其 serverName
per-scope 约束在 0.1.7 变成 scoped 注册，跨 Team 重名约束可能已放开/收紧——按 0.1.7 行为记录。）

### V6 — spill / artifact grant（0.1.7 token 预算触发）

制造大输出触发 0.1.7 token-budget spill：spillStore 写文件；TeamAwareLocalSpillStore 记 durable grant；
owner agent 可读；其他 instance 不可读。

### V7 — lifecycle

member settle/archive/restore（按当前产品支持）+ leader stop；确认 0.1.7 lifecycle 事件变化
（`agent/created` 带 `source` 枚举 'startup'|'resume'|'clear'|'compact'；`agent/session-start` 不存在）
未破坏现有 Team durable transitions。

### V8 — process stop + fresh reboot sanity

停 host → 重启同一 profile → host 本身可重新 boot。**旧 Team 恢复不作为 blocking 判据**：
若 resume 失败 → 记录日志 + session files + service topology + 标 `POST-UPGRADE SESSION-RESUME`，
fresh Team 主路径正常即继续收口。

### 附加 — U3 characterization 探针复测

`tests/characterization/probes/agent-lifecycle/`（P2-T2 探针组：fresh create / member resume /
ordinary root cold resume / ordering trace，经 `tests/characterization/lib/instance.mjs` 的 DshInstance）。
对 0.1.7 复测并记录 diff（pass/fail 变化 + 失败探针的具体断言）。注意 fixture
`fixtures/host-version.json` pin 在 `fb2c4b9e69`（§4.2 先例：两 pin 各自锁定；本轮**只复测记录，
不重录 fixture**——重录是独立 follow-up）。

## 证据与交付

- 证据目录：`dev/agent-workflow/evidence/dsh-017rc1-upgrade/u8/`（任务专属 kit 放这里——kit 归位惯例）。
  每 V 一个子目录（v0-boot/ … v8-reboot/ + install/ + lifecycle-probe/），含原始日志 + 结构化断言结果。
- 顶层 `vertical-summary.md`：V-11.2 + V0–V8 裁决表（PASS/FAIL/DEFERRED + 证据指针）+
  0.1.7 新行为记录 + U3 复测 diff + 新发现的 post-upgrade follow-ups。
- 收尾核验（全部记录）：test-use porcelain 空 + HEAD 46a7f68b09；:3080/:3180 pre==post 读探测；
  端口释放；world 按 §7 清理（证据保留）。
- **不要 commit**（主会话统一提交）；**不要 push**；不要触碰其他 worktree / references / 冻结锚点。
- 若遇真·0.1.7 不兼容（插件加载失败、API 断裂无法在插件侧适配）：完整诊断 + `POST-UPGRADE` 标记 +
  继续其余 V legs，最后汇总报告——U8 的价值恰在于暴露这类问题。
