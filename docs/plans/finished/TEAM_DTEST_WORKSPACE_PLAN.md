# tests\mock Team 全功能测试工作区与测试任务设计（草案，待用户审批）

日期：2026-09-07 ｜ **状态：已归档｜计划范围内执行已完成；9 项 finding 仅记录未修复，2 项任务 blocked-by-finding，外部硬策略项未获最终裁决。**  
**真正执行进度：** T0.1 → P6 全部可执行任务完成；T6 端到端哨兵任务最终跑通。F2/F3/F4/F5/F7/F9/F11/T1.4 及 boot#7 冲突同族已记录；T2.6 blocked-by-F3，T4.1 allow 半程 blocked-by-F9。按用户要求产品代码未修改、未 push。  
**完成时间：** 2026-09-07T13:45:00+08:00（REPORT.md 执行窗口收尾）。（2026-09-07 用户裁决：部署位置 `tests/mock` ✅；执行模式 = **Playwright 全自动** ✅；测试宿主 file policy = **workspace-write** ✅；模型 = **真实模型** ✅（用户已自行配置 API key 至 `.credentials.yaml` 并在会话中实测可用）；交付物 = REPORT.md + findings ✅；仅 §7 第 4 项（boot#3 外部硬策略场景）待用户裁决——已提供详细说明）

## 0. 目标与范围

在独立全新部署（`tests\mock`）中测试 `dsh-agent-team` vNext 的完整行为，覆盖用户点名的三类高级功能 + 全量基础面：

1. **MCP**：team 插件自有 MCP facet（`rowConfig.mcpServer` + 治理门控）与宿主级 MCP row（`@deepseek-ai/dsh-mcp-client`）双轨对照。
2. **Tools**：10 个 team_* 工具的 happy path + 错误路径矩阵（typed result、零副作用、guard、token 纪律、quota）。
3. **权限管理**：Team Control/Approval（3 种 kind × resolver 角色闭包 × exactly-once × 自升级禁止 × External Hard Policy fail-closed）+ 人工 Override 治理面（GUI §19 编辑器）+（视文件策略）DSH 外部审批 lane。
4. 基础面：生命周期（create/delegate/follow-up/message/progress/archive/restore）、持久化与重启恢复、UI 验收（badge、pending decision、governance lane）、端到端业务任务。
5. **G1 观察项**（fresh-home 零 turn root 入口静默）——记录为 OBS，不计 pass/fail，不修复。

**继承红线**：零 upstream 源码修改；不触碰 `:3080` / `D:\deepseek-harness`；`references/deepseek-harness-test-use` 保持 pristine（2026-09-07 分支切至 stable@a66e4702 经用户裁决，仅重建未跟踪构建/依赖状态）；API key 存于 `tests\mock\.dsh-home\.credentials.yaml`（用户写入的 ref）、永不打印；本 run **只记录不修复**（发现记 findings）。

**偏离仓库约定（需审批，见 §7 清单）**：
- DSH_HOME = `tests\mock\.dsh-home`（仓库内，2026-09-07 用户裁决；满足 DSH_HOME 位于工作区内的测试约束）；
- 宿主端口 **3181**（TEST_METHODS.md 的 3180 留给仓库内测试宿主，避免冲突）；
- session workspace = `tests\mock`；"外部"参照区 = `tests\mock-outside`（兄弟目录）。

## 1. 工作区布局

```
tests\mock\
├─ .dsh-home\                      # 全新 DSH_HOME（独立测试部署）
│  ├─ settings.yaml                # 模型路由（从 references/.dsh-test 复制：qiyuan-self/qwen3.8-27b，key 经 env 引用）
│  ├─ .credentials.yaml            # QIYUAN_SELF_API_KEY 引用（原样复制；内容永不打印/入库）
│  ├─ profiles\                    # web profile（从 references/.dsh-test 复制：cordis.yml=[] + package.json bundles + node_modules）
│  │  └─ web\cordis.patch.yml      # ← 测试挂载层（由 boot 脚本生成，5 行）
│  └─ (sessions\ storages\ 首启自动创建 = 全新状态)
├─ hosts\boot-N\                   # 每次启动：host stdout/err + dump-config.txt + health 快照
├─ fixtures\
│  ├─ requirements.md              # T6 业务任务简报
│  ├─ sentinel.txt                 # sentinel 文件（成员须逐字回显）
│  └─ seed-note.txt                # 供 MCP/文件读取任务的种子文件
├─ work\                           # 成员产物区（alpha.md / final.md 等）
├─ evidence\
│  ├─ screenshots\                 # playwright 截图
│  ├─ session-logs\                # durable session log 解码件（tools 数组、tool/call、identity 块）
│  ├─ team-events\                 # team ledger 时间线 dump
│  ├─ findings\                    # FAIL / OBS 逐条记录
│  └─ REPORT.md                    # 最终中文报告（结构同 v2）
├─ state\                          # boot-state.json、p6t6-directive 快照、工具基线（B0 清单）
└─ scripts\
   ├─ boot.mjs                     # 宿主启动（改编自 pw-boot.mjs：DshInstance 链 + ensureProfile + patch 生成 + 双 mini-MCP + health gate）
   ├─ dump-session.mjs             # zstd session log 解码（复用 v2 evidence 工具）
   └─ verify-inventory.mjs         # 工具清单断言（durable log request.tools → 清单/计数）

tests\mock-outside\
└─ probe\                          # "工作区之外"目标区：T4 权限测试的落点（断言：默认不可写/需审批/被策略阻断）
```

- **session workspace = `tests\mock`**（row config `defaultWorkspace: tests\mock`）：会话文件工具默认域 = 整个测试树；`tests\mock-outside` 是边界断言的"外面"。
- 所有脚本/产物只落 `tests\mock`（+ `tests\mock-outside` 的只读断言目标）；**仓库零修改**（本计划文档本身在 `docs/plans/active/`，local/gitignored，不 push）。

## 2. 部署（composition）

### 2.1 全新 DSH_HOME 引导

- 复制 `references/.dsh-test` 的 **profile 树**（`settings.yaml`、`profiles/`；**不复制** `sessions/`、`storages/`、`p6t6-directive.json`、`.credentials.yaml`、`.anonymous-user-id`、`team-client-row/`（v1 遗留，无人引用））→ 得到"已验证 profile + 全新状态"。`.credentials.yaml` 由用户配置 API key 时新建（全新 home 不携带旧 key；key 仅入 spawn env，永不打印）。**注意**：profile 树的 `node_modules` 是链接农场（4 个实体文件 + 273 个指向宿主树的 junction；`fs.cpSync` 会跟随 junction 在环上栈溢出 0xC0000409）→ 用 `scripts/copy-profile.mjs`（lstat 遍历、junction 原样重建）复制。
- **2026-09-07 事件（用户裁决）**：test-use checkout 被从记录基线 `76fda729` 切到 `stable` 分支（`a66e4702`，"release(dsh): 0.1.2-rc.1"，2026-09-03，为基线的祖先）；磁盘残留旧基线时代的 `apps/cli/lib` 构建产物与 node_modules（其中 `dsh-http-proxy` 链接指向 stable 中不存在的包路径）→ 宿主启动失败（ERR_MODULE_NOT_FOUND）。用户确认属切换分支后的正常现象，裁决：在 test-use 树执行 `pnpm run clean` + `pnpm install` + `pnpm build`（仅改写未跟踪的构建/依赖状态；源码保持 stable clean）后启动。配套：profile 改为 `MOCK_PROFILE_MODE=fresh`（ensureProfile throwaway boot 按 stable 树重新初始化，弃用旧基线链接农场）；`boot.mjs` 的 `DSH_CLIENT_COMMIT_HASH` 改为动态读取宿主树 HEAD（不再硬编码 76fda72979）。v2 基线引用（76fda729）保留为历史记录。
- **2026-09-07 契约发现（blueprint requirements domain）**：blueprint DTO 校验要求 `requirements[].domain` 为**小写 slug**（`^[a-z][a-z0-9-]{0,63}$`），但 closed bridge（`packages/runtime/compatibility/blueprint.ts`）同时接受 `mcp`/`mcpServer`、`model`/`modelRoute` 等键（camelCase 键实际不可达——`teamStructure` 域无法经 blueprint YAML 声明）。blueprint YAML 中 MCP 需求须写 `domain: mcp`（bridge 映射到 requirement type `mcpServer`）；environmentFacts 的 domain 用 camelCase 类型名（`mcpServer`，与 fixtures 一致）。boot#1 首次实启即触发 `TeamContractError: field $.requirements[1].domain must be a lowercase slug (max 64), got "mcpServer"` → 已修。
- profile 由 `DshInstance.ensureProfile` 兜底（throwaway boot 初始化）。
- 模型：真实模型 `qiyuan-self/qwen3.8-27b`（settings.yaml 已含 provider；key 从 `.credentials.yaml` 引用进 spawn env，永不打印）。无 mock。

### 2.2 cordis.patch.yml（boot 脚本生成，5 行）

| # | id | name | 说明 |
|---|----|------|------|
| 1 | `dsh-agent-team` | `file:///…/packages/runtime/dist/…/plugin/host.js` | 生产 dist host row（配置见 2.3） |
| 2 | `dsh-agent-team-client` | `file:///…/packages/client/composition-shim/index.js` | Team UI 客户端 |
| 3 | `p6t6-team-tools` | `file:///…/packages/tools/harness/plugin.mjs` | 可观测性 row：`GET /__p6t6/health` → `{ok, toolCount, liveSessions}` |
| 4 | `dtest-mcp-http` | `@deepseek-ai/dsh-mcp-client`（宿主级 MCP row） | `transport: streamable-http`, `url: http://127.0.0.1:3492/mcp`, `serverName: dtesthttp` |
| 5 | —（非 row） | mini-MCP #1 | `packages/runtime/root-binding/harness/mini-mcp.mjs` 启动于 **3491**，由 boot 脚本持有；**team facet** 服务端（`rowConfig.mcpServer.name = dtest-mini`，glue 经 streamable-http 挂载，单工具 `ping`→`pong:` 回环） |

> 双 mini-MCP 对照设计：`dtest-mini`（3491）= **插件 MCP facet**（治理门控、per-instance、可卸载/重挂）；`dtesthttp`（3492）= **宿主级 MCP row**（对所有会话可见、连接监督自带重连）。零外部依赖（不用官方 MCP server 包，profile 无需安装任何东西）。

### 2.3 team host row 配置（`dtest-bp@1`）

```
rootSessionId: session-dtest-<nonce>      # 每次 run 新 nonce；重启 run 用 env 覆盖（同 pw-boot 模式）
bootPhase: create-or-open
blueprintSource: dtest-bp@1（内联 YAML）：
  leader:    templateId=leader，persona=协调者（经 team_* 工具协调、回报确凿文件内容/命令输出）
  members:
    - templateId=worker，    displayName="DTest Worker"，persona=精确执行者（读文件/跑命令、逐字回报）
    - templateId=collector， displayName="DTest Collector"，persona=采集者（必须引用工具原始输出）
  requirements:
    - domain: persona,      name: standard
    - domain: mcp,          name: dtest-mini          # 小写 slug 域；bridge 映射 mcp→mcpServer（camelCase 域过不了 DTO 校验，2026-09-07 契约发现）
  teamEnvelope:  allow: [assign-task, create-member, send-message, report-progress, archive-member, restore-member]
                 deny:  [delete-team]
  memberEnvelopes: worker / collector 各 {allow: [send-message, report-progress], deny: []}
  policyStates: [default]
  quotas: members {maxInstances: 4, maxConcurrent: 4}
defaultWorkspace: tests\mock
staticModel: {provider: qiyuan-self, model: qwen3.8-27b}
deniedSelection: {provider: dtest-denied, model: dtest-denied}
mcpServer: {name: dtest-mini, port: 3491}            # team facet 服务端（默认策略未 allow → 未挂载，见 T3.1）
environmentFacts: [tool:web ✓ gen1, skill:base ✓ gen1, persona:standard ✓ gen1, mcpServer:dtest-mini ✓ gen1]
externalPolicyFacts: boot#1/#2 = {hard: {}, capabilityExists: {}}
                     boot#3 = {hard: {tools: {kind: 'deny'}}, capabilityExists: {}}   # T4.7 外部硬策略
glueUrl / seamUrl: 仓库 dist 产物 file:// URL
directive: {boot, phase, rootSessionId, runStamp, mcpPort: 3491}   # 写 DSH_HOME/p6t6-directive.json
```

## 3. 测试任务清单

> 判据约定：模型非确定性（qwen3.8-27b）——模型不合规 ≠ 产品缺陷；凡涉及"模型应调用某工具"的任务，均以 durable log 的 tools 数组 / tool/call 记录为准，提示词重试 ≤3 次后仍不触发记 MODEL-NONCOMPLIANCE（非 FAIL）。

### P0 — 准备（审批通过后执行）
- **T0.1 搭建**：scaffold §1 全部目录；`boot.mjs`（参数化 DSH_HOME/端口/workspace/nonce/blueprint/externalFacts）；`dump-session.mjs`、`verify-inventory.mjs`；fixtures 内容。
- **T0.2 干跑**：boot → health gate（ok、toolCount=10、liveSessions 含 row root）→ row dump 验证 5 行挂载 → 客户端 bundle serve 探测（boot-graph `/plugins/` URL）→ **T3.8a**（负向：把 `dtest-mcp-http` row 的 url 指向死端口 + `failOnStartupError` → 宿主启动 **loud fail**，misconfig fails loud）→ 拆机；port 3181/3491/3492 释放验证。
- 交付：干跑日志 `hosts/boot-dryrun/`；审批门禁检查单（:3080 未受影响、test-use porcelain 空）。

### P1 — 启动与基线（boot #1，phase=create）
- **T1.1 全新 home 启动**：双 mini-MCP（3491/3492）+ boot → health gate PASS；boot-state 记录。
- **T1.2 G1 观察项（OBS，不计 pass/fail）**：row root 为零 turn root——会话树无条目；Team tab 零态 persisted-roots 列表出现该行；点"以 Team 模式打开"→ 记录 UI 行为（预期：静默 no-op、无 badge、无错误；host 侧 ensureRootLive 成功——`liveSessions` 证 leader 复活）；占位处发送 → 落入新标准会话。截图 + log 摘录。**fresh-home 环境验证 G1**（v2 已两次复现；此处补 fresh-home 证据）。
- **T1.3 基线工具清单**：标准会话发 1 轮探针 → `verify-inventory.mjs` 断言：base B0（v2 实测 26，此部署重测定）+ **`mcp__dtesthttp__ping` 在**（宿主级 MCP row 生效）+ **team_* 不在**（N-a 边界）→ B0 清单落 `state/baseline-inventory.json`。
- **T1.4 UI 新建团队**：team.create 建 root **R1** → 会话树出现 R1（原生注册存在）→ 打开 → 「Team 模式」badge → leader 会话就绪（durable log：B0 + 10 team_* + `mcp__dtesthttp__ping`）。

### P2 — Tools（R1 内）
- **T2.1 team_list_templates**：leader 列出 dtest-bp 模板（leader/worker/collector）。
- **T2.2 team_create_member ×2**：W1=worker、W2=collector → 确定性 instance id；W1 首请求 **identity 块**（`[team-member-context rootSessionId=… instanceId=… role="member"]` + fresh-requestToken 规则）；W1/W2 工具清单 = B0 + 10 team_* + `mcp__dtesthttp__ping`（**不含** `mcp__dtest-mini__ping`——见 T3.1 默认拒绝）。
- **T2.3 team_delegate**：W1 新工作流 → work admitted；W1 产出 `work/alpha.md`（含 sentinel 逐字内容）。
- **T2.4 team_follow_up**：对 W1 继续指令（guarded continue）→ 第二 turn 正常。
- **T2.5 team_send_message**：leader→W2（guarded）→ wire 形态 `memberResult:{requestToken, status:"succeeded", body}`；W2 收到内容。
- **T2.6 team_report_progress**：W1 报 progress（in-progress→done）→ UI 进度展示 + activity ledger 落账。
- **T2.7 team_list_members**：状态/last-activity/instance id 与实况一致。
- **T2.8 team_inspect_config**：W1 instance 定向配置（template/envelope/model view）。
- **T2.9 错误路径矩阵**（全部期望：typed result、零副作用、runtime 不被调用/不执行）：
  - a. `team_send_message` target=**label**（非 instance id）→ `TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED`
  - b. `team_create_member` 缺参/超长参 → `TEAM_TOOL_BAD_ARGUMENTS`
  - c. requestToken **跨操作复用** → token 校验拒绝
  - d. `team_follow_up` 对已 settle/archive 成员 → typed 拒绝
  - e. 标准会话 durable log 断言 team_* 不在 tools（模型物理上不可调用）
- **T2.10 archive/restore**：archive W2 → list 状态变化；restore-member（envelope 已 allow）→ 复活。
- **T2.11 quota**：第 5 个成员（> maxInstances 4）→ quota 拒绝（typed）。

### P3 — MCP（插件 facet + 治理，核心高级功能）
- **T3.1 facet 初始态（fail-closed 默认）**：mcpServer 已配置但持久策略未 allow `dtest-mini` → W1/W2 工具清单 **无** `mcp__dtest-mini__ping`；**同时** `mcp__dtesthttp__ping` **在**（双轨对照成立）。
- **T3.2 人工 Override（GUI §19 治理 lane）**：Team tab → per-member override 编辑器（`data-governance-override-*`）：capability=**mcp**、kind=**allow**、items=**dtest-mini**，对 **W2** "设置覆盖" → 记录 admitted（generation +1；Team Events 出现 override mutation）。
- **T3.3 下一边界挂载 + 调用**：触发 W2 下一 turn（team_follow_up 提示"用 MCP ping 工具验证连通"）→ 请求 tools 出现 `mcp__dtest-mini__ping` → 模型调用 → `pong:` 回环（durable log tool/call + result）。**W1 同一时刻的 turn 仍无该工具**（per-instance 作用域）。
- **T3.4 卸载**：W2 override 改 **deny**（或 set deny）→ 下一 turn 工具消失；状态显示 team-denied by record。
- **T3.5 重置**：W2 override **reset** → 值从下层重算（回到未 allow → 不挂载）。
- **T3.6 hard-policy 展示 lane**：governance hard-policy lane 正确渲染外部 facts（此刻为空 → 无外部硬限制）；**不得把 override 展示为压过 hard policy**（UI 契约核查）。
- **T3.7 宿主级 MCP 功能**：leader/W1/W2 各调一次 `mcp__dtesthttp__ping` → 三类会话全通（宿主 row 对团队会话同样可见）。
- **T3.8 失败模式**：
  - a.（并入 T0.2）死 url + failOnStartupError → 启动 loud fail。
  - b. 运行中 kill mini#2（3492）→ dsh-mcp-client 连接监督**自动重连**（工具短暂不可用后恢复，无崩溃）；kill mini#1（3491，facet）→ 该 turn 工具调用 surface 错误、facet 卸载（activation error 记录）；重启 mini#1 → **下一边界自动重挂**（allowed && fiber 缺失 → 重新 mount）。

### P4 — 权限管理（Control/Approval，核心高级功能）
> 触发方式：control request 只能由模型经 `team_request_control` 发起（工具层）；任务提示词显式引导（"若需工作区之外的操作，必须先请求 user-approval"），重试 ≤3。
- **T4.1 user-approval 全链路**：W1 需写 `tests\mock-outside\probe\`（超成员自治边界）→ `team_request_control kind=user-approval` → Team Header/Dock "1 pending decision" → 点击 → 详情面板（requester/kind/operation/reason/time/status/requested authority）→ **用户点 allow** → 成员 trajectory 出现真实 tool call（或操作放行）。
- **T4.2 resolver 角色闭包（user-approval）**：构造 leader 以 `team_resolve_control` resolve 一个 **kind=user-approval** 的请求 → **被拒**（leader 不能代替用户；角色闭包先于 envelope）。
- **T4.3 leader-approval**：W1 请求 kind=leader-approval → **leader（模型）** 经 team_resolve_control allow → 操作放行。
- **T4.4 deny 路径**：请求 → leader/用户 deny → 操作**永不执行**（成员 trajectory 无副作用 + typed result）。
- **T4.5 exactly-once**：allow 决策被 last-mile guard 消费后，**同 tuple + 同 correlation 的第二次尝试 → BLOCKED**（consumed）；新操作必须新 correlation（新 request）。
- **T4.6 自升级禁止**：W1 以 team_resolve_control resolve **自己**的请求 → **被拒**（member never a resolver，invariant 37）。
- **T4.7 External Hard Policy（boot #3，phase=resume + `hard.tools: deny`）**：
  - a. W1 发起（unguarded，可建请求）leader-approval 请求 → leader/用户尝试 allow → resolve **拒绝** `CONTROL_EXTERNAL_POLICY_DENIED`；**durable deny 行（reason=external-policy）先落账**、请求 closed；**leader 重试不能推翻**。
  - b. UI 呈现核查：该状态呈现为"外部策略阻断"语义（Team Events / 决策面板），**不得显示成 "approval failed" 或成功**（UI 设计 §26.4 契约）。
  - c. 对照：boot#3 下 team 内部纯协调（不触外部工具 cell 的操作）仍可用 → 精确性（只阻断 tools cell）。
  - d.（变体，可选）`capabilityExists.mcp=false` → mcp facet 被外部拒（capabilityMissing），即使 team override allow → 外部恒胜（invariant 34）。
- **T4.8 DSH 外部审批 lane（条件项）**：成员写 `tests\mock-outside` 触发 DSH 宿主审批提示（若测试宿主 file policy 为默认 workspace-write）→ 用户 deny → 工具 blocked；验证 team control lane 与 DSH approval lane **并存独立、各自留痕**。若宿主策略宽松无提示 → 记环境注记（非失败）。

### P5 — 持久化与重启
- **T5.1 F5 刷新**（boot#1 中）：页面重载 → Team tab / 成员列表 / pending decisions（如有）/ badge / governance 状态全部恢复。
- **T5.2 boot #2（phase=resume，同 R1）**：leader 冷复活；W1/W2 重绑；**确定性 instance id 不变**；工具清单复证（10 team_* + `mcp__dtesthttp__ping`）；**持久记录恢复**：control 请求/决策历史、override 记录（governance 面板可见）、progress 账本。
- **T5.3 boot #3（phase=resume + external hard facts）**：执行 T4.7 组；验证 facts 注入生效（durable 决策留 external-policy 痕）。
- **T5.4 team-domain 持久化**：`tests\mock\.dsh-home\storages\team_domain.json` 存在且与 UI 状态一致（root/成员/决策记录）。

### P6 — 端到端业务整合（F2）
- **T6.1 业务任务**（用户在 R1 leader、Team 模式发 prompt，或 playwright 代发）：
  > "读 `fixtures/requirements.md`。拆两个工作流：① W1 把 `fixtures/sentinel.txt` 的内容**逐字**写入 `work/alpha.md`；② W2 用工具读 `fixtures/seed-note.txt` 并总结写入 `work/summary.md`。两者各 report progress 一次。最后你汇总 `work/final.md`，必须包含两个文件路径、sentinel 原文与 W2 总结要点。"
- **T6.2 断言**：磁盘文件存在（`work/alpha.md` 含 sentinel 逐字、`work/summary.md`、`work/final.md` 含路径+sentinel）；Team Events 时间线完整（create→provision×2→delegate×2→message→progress×2→settle）；UI 成员状态 settled；leader 回报含确切路径。
- **T6.3 sentinel 核验**：durable log 中 W1 逐字 sentinel 串（dump 工具比对）。

## 4. 证据与验收

- 每任务：步骤 / 预期 / 实际 / 证据（截图路径、log 摘录、durable 文件、`/__p6t6/health` 快照）→ 汇总 `tests\mock\evidence\REPORT.md`（中文，结构同 v2 报告）。
- 通过口径：在范围内任务 PASS，或 FAIL/OBS **完整留痕**（记录不修复）。
- v2 遗留 findings（G1 零 turn root 入口、G2 picker 无 `.catch`、B1 D4-A1 作用域）：若本 run 复现/涉及，附记入 findings。
- **post-flight**：拆机（宿主 + 双 mini-MCP）；3181/3491/3492 释放验证；`:3080` 未受影响；`references/deepseek-harness-test-use` porcelain 空 + HEAD 未动；仓库零代码改动。

## 5. 执行模型

| 角色 | 职责 |
|---|---|
| 主 Agent（我） | T0 全部搭建；所有 host 侧操作（boot/重启/kill/拆机/dump/断言）；playwright 驱动 UI 操作（v2 已验证的 selector 集）；证据收集与报告 |
| 用户 | 审批本设计；API key 已配置（`tests\mock\.dsh-home\.credentials.yaml`，2026-09-07 会话实测可用）；裁决 §7 第 4 项 |

- 执行模式（审批项 2，**已批**）：**A. playwright 全自动**（v2 已验证、全程留痕、用户可离线复核截图）。
- 测试宿主 file policy（审批项 3，**已批**）：**workspace-write**。机制：宿主 `permission-presets`（`references/deepseek-harness-test-use/packages/interaction/permission-presets`）——session 级 `permission/preset` → `{sandbox: 'workspace-write', approval: 'ask'}`；T1.1 在 patch 层把默认 preset 固定为 workspace-write 并以 session prompt 行 `Current DSH file policy: workspace-write` 验证；T4.8 DSH 审批 lane 保持可测。
- 模型（审批项 5，**已批**）：`qiyuan-self/qwen3.8-27b` 真实模型（API key 用户已配置；模型不合规 ≠ 产品缺陷，按 ≤3 次重试后记 MODEL-NONCOMPLIANCE）。
- 预估：干跑 ~15 min；正式 run ~2–3 h（真实模型 turn：P2/P3/P4/P6 合计约 30–45 个模型 turn + 3 次 host 启动）。

## 6. 设计依据（仓库内证据锚点）

- 10 个 team_* 工具闭集与 delegate 语义：`packages/tools/src/tools.ts`（P6-T6 表）。
- Control 语义：`packages/runtime/control/types.ts`（3 kinds、resolver 闭包、allow/deny/stale-denied、exactly-once 消费）、`packages/runtime/test/p6t4-*.test.ts`（外部策略 fail-closed）。
- 外部策略公式：`P_effective = P_externalHard ∩ P_capabilityExists ∩ P_TeamResolved`（`packages/domain/policy/src/resolve.ts`）；capability 闭集 `model/tools/permissions/skills/mcp`。
- MCP facet：`packages/runtime/dist/…/live/agent-bindings.mjs`（`mcpServer {name,port}` → streamable-http `http://127.0.0.1:<port>/mcp`、failOnStartupError、per-agent fiber、mount/dispose）；mini-MCP：`packages/runtime/root-binding/harness/mini-mcp.mjs`（ping 工具）。
- 宿主级 MCP row 形态：`references/deepseek-harness-test-use/packages/mcp/mcp-client`（stdio / streamable-http 双 transport 配置 schema）。
- 治理 UI：`packages/client/src/ui/TeamGovernance.tsx`（per-member override 编辑器：capability/kind/items + show/set/reset；hard-policy 展示 lane）、`team-remote-client.ts`（override.get/set/reset）。
- row 配置字段与 boot 链：`packages/runtime/src/plugin/host.ts`（rowConfig 校验）、`dev/agent-workflow/evidence/playwright-acceptance-v2/pw-boot.mjs`（DshInstance 链、health gate、bundle 探测、directive、junction 桥）。
- v2 实测基线：base 工具 26、leader 恰 10 team_*、member 36、sentinel 逐字回显、D5 确定性 id、D6 重启恢复（`dev/agent-workflow/evidence/playwright-acceptance-v2/REPORT.md` @ `3f06525`）。

## 7. 审批清单（用户裁决项）

1. **部署位置**：`tests\mock`（仓库内，**已批准** — 2026-09-07 用户由 D:\test 改判）+ DSH_HOME=`tests\mock\.dsh-home` + 端口 **3181**（用户指定）——✅
2. **执行模式**：——✅ **Playwright 全自动（A）**（2026-09-07 用户裁决）
3. **测试宿主 file policy**：——✅ **workspace-write**（2026-09-07 用户裁决；机制与验证点见 §5）
4. **外部硬策略场景**（boot#3 `hard.tools: deny`）纳入计划——**待裁决**（2026-09-07 用户要求详细说明，已在会话中给出：P6-T4 契约 = 外部硬 deny 使 allow 不可能，即使 human allow 也 fail-closed，持久化 deny(reason external-policy) 先落再抛 CONTROL_EXTERNAL_POLICY_DENIED；probed cell 语义 absent=pass / deny=拒 / allow-list 须点名工具；facts 在 allow-resolution 时 live 探测、deny 决议不探测；UI governance hard-policy lane 显示 请求/生效/原因）。
5. **模型**：——✅ **真实模型** qiyuan-self/qwen3.8-27b（2026-09-07 用户已配置 API key 并会话实测可用）
6. **交付物**：——✅ `tests\mock\evidence/REPORT.md` + findings（只记录不修复；如需修复另行审批）；仓库零代码改动、不 push
