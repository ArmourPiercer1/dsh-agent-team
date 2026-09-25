# POST-UPGRADE FOLLOW-UPS（0.1.7-rc.1 升级后待办，非本轮 blocking）

来源：0.1.5-rc.2 → 0.1.7-rc.1 升级轮（`task/dsh-017rc1-upgrade`）。
plan §17 要求 session-resume / restart 单列——见 F1。

## F1. session-resume / restart（plan 强制单列）

0.1.7 的 lifecycle 事件面（`agent/created` 带 `source` 枚举、`agent/session-start` 缺席）与
session log V4（`session.v4.jsonl.zstd` + v0→v4 迁移链）已在本轮适配（U3）并单测覆盖。
**U8 V8 实测**：旧 Team 跨进程重启恢复不作为本轮 blocking 判据。
**（U8 结果回填 @ 2026-09-24，最终）**：resume 正常——**全部 6 次含 V8 的完整 run（run-3/7/8/9/10/11）的 V8 均 PASS**（定稿 run-11 75/75）：进程 stop + fresh reboot（boot 2, `bootPhase: resume`）后旧 Team 被 strict load-only 重新 adopt（p6t6 state `phase: resume` + durable `teamSession` 载入，`v8-reboot/p6t6-state-2.json` + instance-2.log 启动行，run-11 token `JhrEQGdG7W0QdHl-GSdaWvIcDsXzGa1x46Jrcbl0hEs`），session logs 全部 V4 命名（`session.v4.jsonl.zstd`，v4=4 total=4），无 POST-UPGRADE SESSION-RESUME 标记触发。
无论本轮实测正常与否，**不得声称 B/B+ resume 架构问题已解决**——应在升级完成后以
0.1.7 新基线重新分析（新 0.1.7 fixture 重录 + probe 全量自检也是同一 follow-up 的一部分，
见 `docs/TEST_METHODS.md` §4.2 的降级 manual 历史）。

## F2. 发布件打包 quirk（upstream 面，系统性）

- **dsh-client-store@0.1.7-rc.1**：lib import `zustand/vanilla|middleware|shallow` + `immer`，
  但 `dependencies` 为空（upstream 源码把两者放在 devDependencies；真宿主 app 壳自带 → 生产无感）。
  本仓库以 client 包 devDeps 补齐（zustand ~4.4.7 / immer ^10.1.1，commit d09c010）。
  同类扫描：其余 0.1.7 client 发布件（ui-primitives/ui-renderer/ui-session/ui-slots/web）
  也有未声明依赖（完整清单见 `mcp-regression.log` §"本轮同现的图漂移"），仅 dsh-client-store
  落在本插件根的 import 链上。→ upstream 反馈候选。
- **dsh-spill-policy@0.1.7-rc.1**：published lib stale（`maxInlineBytes` 面 vs 源码
  `maxInlineTokens` 12500 语义）——见 `spill-migration.log` 的 post-upgrade 节。

## F3. 0.1.7 行为面注记（非缺陷，使用方应知）

- **mcp-client reconnect supervisor 默认启用**：初始尝试仍受 `failOnStartupError` fail-closed
  约束（插件启动语义不变）；运行期断连自动重连 ≤10 次（initialDelayMs 500 / maxDelayMs 30000）。
  单 live Team 稳定性改善（D-3 类健壮性同向）。→ `mcp-regression.log` 已记录。
- **mcp-client serverName per-scope 独占**：同 Agent 内重名 load 时 throw（跨 Agent 可复用）——
  与插件 Finding-1 bridge（Agent-keyed scope 挂载）互相强化，无需改动。
- **plugin version-compat check**：0.1.7 安装/启动时按 `peerDependencies` 中 `@deepseek-ai/dsh*`
  range 校验（semver includePrerelease；fail-closed + 精确豁免 `allow-version --accept-risk`）。
  本插件 root manifest 无 peerDependencies → 直接通过。**建议后续给插件声明显式
  `@deepseek-ai/dsh` peer range**（如 `>=0.1.7-rc.1`），让 0.1.7 的 compat 门对本插件真正生效
  （当前为空 = 恒通过 = 门形同虚设；声明是产品决策，超出本轮"验证通过"范围）。
  → **CLOSED @ PR29 review-supplement 轮（F1 发现项，2026-09-25）**：按 review 裁决声明
  **精确 RC range `0.1.7-rc.1`**（commit 1a3a3ad，非 `>=`——RC 期精确匹配，避免 rc.2 漂移误放行）；
  新世界 git-install 复证 = 0.1.7-rc.1 运行时无豁免通过、0.1.5-rc.2 反事实 RAISE issue
  （门现真正约束本插件；`review-supplement/real-host-smoke.md` H1 + `h1-peer/evaluation.json`）。
  附注：声明触发 pnpm lockfile 再解析（多集 diff = 恰 +1 伞宿主树；实例 churn 语义中性）与
  client 测试 fixture 的 usePanelInfo 编译适配（`review-supplement/compatibility-peer.md` §4/§5）。

## F4. test-infra 加固（本仓库面）

- **a2c7 pinned lib 依赖显式化**：`a2c7-subtree-matcher.test.ts` REAL 段硬依赖 test-use
  checkout 的**预构建** `packages/fs/fs-local/lib/index.js`。test-use 构建产物缺失时 9 测试失败
  （按设计降级但断言 red）。→ 应在该测试或 root 套件文档中显式声明"test-use 已构建"前提，
  或把降级路径改为 skip（0 测试计数）而非 fail。
- **test-use 换基线协议**：换 DSH 基线时必须 `git clean -fdx` 完全重置 + 全新 install + 重建
  （本轮实测：跨代构建残留——孤儿 settings-file 目录 + stale 根 lib/types typert 产物——导致
  两次构建失败）。`docs/TEST_METHODS.md` §2 应补一句"换基线 = 完全重置，不是 git checkout"。
- **pnpm store 沙箱约束**：workspace-write 沙箱下 pnpm 全局 store（~/.local/share/pnpm）只读 →
  EROFS；任何 test-use 侧 pnpm 步骤需 workspace 内 store（XDG_DATA_HOME 重定向，先例
  `git-install-boot.mjs`）。`docs/TEST_METHODS.md` §2 的 install 行应补 `--store-dir`/XDG 注记。
- **characterization fixture 重录**：`tests/characterization/fixtures/host-version.json` pin
  `fb2c4b9e69`（0.1.5），与 0.1.7 测试运行时基线不同源（§4.2 两 pin 各自锁定的既有设计）。
  0.1.7 全量 probe 重录 = 独立 bounded task（本轮只做 U3 相关探针复测记录）。

## F5. 基线 test debt（PRE_EXISTING，本轮不修）

10 文件 / 20 测试的既有失败集（t1-capability-schema ×9、t2-blueprint-hash、p7t6、p6t3-mediation ×5、
p6t3-restart ×2、p6t6-actions、d3-4、p8s3b/t12a-b2/t12a-glue 三个文件级环境类）——升级前后逐测试
相同，见 `failure-classification.md`。其中 t1 的 YAML 解析失败（"Unexpected block-seq-ind" +
"$.metadata must be a plain object, got null"）值得在独立轮次定位（疑似 legacy fixture 与当前
validator 语义漂移，非 0.1.7 引入）。

## F6. U8 实宿主垂直发现（回填 @ 2026-09-24，run-1…run-8）

U8 在 pristine 0.1.7-rc.1 实宿主（test-use @ `46a7f68b09`）上跑了 8 轮垂直（worlds run-1…run-8 全部 RETAINED，见 `u8/vertical-summary.md` (c)/(f)）。**零 upstream 修改**；全部适配落在 kit（`u8/vertical.mjs`）与 harness mock（`packages/tools/harness/mock-deepseek.mjs`，dual-protocol）。发现清单（详述与证据指针见 `u8/vertical-summary.md` (c.1) 1–13）：

1. **compat preflight 拒绝无 name 的 override 行**（0.1.7 新功能的真实 bug 候选：`compatibility-preflight.ts` → `manifestOf` 在 `row.name===undefined` 时 TypeError，行被静默禁用并给出误导信息）→ upstream bug report 候选；kit 侧已用 named override 行适配。
2. **remote session API 变更**：`POST /api/session/create`（显式，`{sessionId?,cwd?,workspaceId?,agentPreset?}`）+ per-method 端点 `/api/session/<method>`（错误端点 → `gateway/bad-request`）；`session/prompt`（mode queue）**在 accept 时 resolve**（`{accepted:true}`，~ms）——turn 异步跑。kit 的 session/prompt-on-accept 模式需沉淀进 kit 复用。
3. **LLM wire = DeepSeek Messages API**（`POST /v1/messages`，Anthropic 风格 SSE，top-level `system`，tool_result 走独立 user 消息，tool_use 块需 `input:{}` start）→ harness mock 已 dual-protocol（`/chat/completions` 保留供 0.1.5/T12 兼容）；`packages/tools/harness/` 的 mock 现为 tracked 资产。
4. **dump-config 分层渲染**（bundle 段 + profile-patch 段；`totalIdLines=2`，runtime override 仍有效）——检查类脚本须按段计数。
5. **session log V4 = `sessions/<proj-hash>/session-<id>/session.v4.jsonl.zstd`，是拼接 zstd frame 流**（每 write-batch 一帧；Node 单帧 API 只解第一帧）→ 解码须按 magic `28 B5 2F FD` 切分（scratch 解码器 `u8/u8-live-state/decode-v4.mjs`，可入 `tests/kits/`）。
6. **表面事实**：ordinary `standard` = 26 tools（含 `subagent`/`subagent_fork`）；team root = 39（+13 `team_*`）；`lsp`/`pwsh` 未托管（记录在案）；title side-call 无 tools（可靠过滤器 = `tools.length===0`）；turn 静默 ~20s 后 `turn/end`。
7. **tool_result 交错布局** → 任何"当前轮结果"判定须以**最后一条带 text 的 user 消息**为界（不是最后一条 assistant）。
8. **0.1.7 repetition guard**：完全相同的 tool call 重放会注入 user 消息"You are repeating the exact same tool call…"（V4 `agent/inbox/spliced`），下一步模型以 text 收尾 → turn 结束。脚本化 mock 的 decide 必须避免逐字重放。
9. **`tools.restrict()` 校验 + `subagent` own-layer 豁免**：0.1.7 起 restrict 只接受 inherited/global 层名，`subagent`（per-agent own-layer）传入即 throw（`TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED` 的根因）；surface 派生的 deny list 必须过滤非 restrictable 名。**插件侧 follow-up**：builtin-deny 的 restrict 包装应容忍/剥离非 restrictable 名（否则任何从 0.1.7 surface 派生的 blueprint deny 都会炸 team.create）。
10. **bash tool 新增必填 `description`**（缺 → `invalid arguments: missing required property "description"`，且发生在审批之后）——0.1.5 时代的裸 `{command}` 调用全部失效。
11. **`requestToken` = work-unit 幂等键**：复用已 settled 的 token → `WORK_REPLAYED`（envelope 看似成功 `status:"executed"`，实际 `memberResult.status:"unavailable"`，member 不启动）——每次 team-tool 调用必须新 token；GUI/自动化消费方应把 `memberResult.status:"unavailable"`+`WORK_REPLAYED` 当作显式失败。
12. **p6t6 control feed 按 team root 限定**：created team 的 pending approval 永不出现在 directive-root 的 `/__p6t6/state`（`listControlState` 过滤 `rootSessionId===bound root`），但 durable 记录在 `storages/team_domain.json`（double-encoded 行：`control-request-recorded`，无 `status` 字段，pending = 无对应 decision 行）。**插件侧 follow-up**：harness 无法展示 created team 的 pending approval——需 per-team 查询或在 directive state 中汇总 created-team 请求。
13. **spill 语义**：`maxInlineTokens: 12500`（token 预算，无 byte 阈值；0.1.5 `maxInlineBytes` 面已失效，与 F2 的 stale lib 呼应）；notice 词法 `Full formatted result stored at: <locator>. <hint>`（locator 后紧跟 `.`，naive 抓取会带尾点）；**domain-store 文件按 domain commit 批量落盘**（非 per-fact、非短定时器：run-7 实测 artifact-read-granted fact 创建后 ≥21s 未落盘，V7 archive commit 的 mtime 时已在盘上；所有 run 的 retained world 均含该 fact）——任何"读回 durable 行"的断言必须跟随其后的 domain 操作并轮询（kit 已固定为 V7 archive commit 后 + 15s 轮询）。注：run-7…10 的读回失败另有 kit 自身 bug（`findStrings` JSON 树遍历器被用于原始文件文本，字符串输入恒返回 `[]`，扫描全程失明）——已修复为原始文本 `includes`。插件侧 follow-up：control/turn 边界是否强制 flush 或文档化延迟。
14. **非 leader 实例的 ask-lane 操作 fail-closed**：member 的 ASK-lane read 触发 `request-control`，被 mutation envelope 拒绝（"operation 'request-control' is outside the caller's mutation envelope — the boundary fails closed"）→ 表现为工具错误而非 pending approval（run-7 V6b 的 deny 机制即此；插件 envelope 设计的 0.1.7 面表现，记录在案）。
15. **U3 探针复测**：20P/14F（vs 基线 34P）——两个根因均为 0.1.7 面（session log V4 命名 + `session.events` 词汇移除），非插件回归；fixture 重录 + probe 全量自检并入 F1 的 0.1.7 新基线重分析（probe world `u8-017rc1-probe-2026-09-24T13-13-03` RETAINED，`u8/lifecycle-probe/`）。

**kit 侧沉淀（可入 `tests/kits/`）**：dual-protocol mock、named override 行生成、session/create+prompt-on-accept、durable-fact-store approval discovery（double-encoded 行走查）、requestToken 一次性、domain-store 轮询读回、multi-frame V4 解码、repetition-guard 安全的 decide 设计。

## F7. PR29 review-supplement 轮新发现（2026-09-25，H1–H3 + 静态闸期间）

1. **p6t1-parallel 间歇 flake = 插件自身 compatibility admission 链的既有并发竞态（类 E：新暴露的既有不稳定）**。
   现象：supplement 状态全量并行跑 p6t1-parallel 约 40% 失败，错误 =
   `activation: compatibility could not be established (reprobe-failed) — admission fails closed (invariant 50)`
   （`activation/provider.ts:654` ← `compatibility/authority.ts:259-270`）。
   机制：每次 activation 请求新建 authority（`provider.ts:629`）→ 新 prober（`authority.ts:235`），
   而 prober 的 `withLock` 序列化锁是 **per-prober-instance**（`probe.ts`，"one durable writer per prober"
   的本意是 per-root）→ 同 root 的两个并行激活 = 两个未同步的 probe；probe 的持久写
   `replaceState` = delete→put→advanceGeneration 三段独立 await（`probe.ts:256-260`），
   交叠时第二个 probe 的 get 落入 delete→put 间隙 → probe reject → REPROBE_FAILED → fail-closed。
   A/B 归因（7 行矩阵，含"新 lockfile node_modules + 基线源码"隔离行与 +16 核 OS 负载行，
   全部 PASS → 排除 lockfile 再解析与 OS 负载两个假设；vitest `pool:'threads'` 全文件同进程 →
   本轮 +14 测试扩大同进程调度窗口 = 触发器；p6t1 standalone 双状态 0/5）：
   详见 `review-supplement/p6t1-flake-attribution.md`。
   **建议修复（本轮不修，超文件范围——runtime compatibility 链）**：per-root-session 的
   re-probe 序列化（跨 authority 实例共享的 root-keyed promise chain 包住 `probe` + replaceState 三元组），
   恢复 P6-T1 "one durable writer" 的 root 语义；修复后 P1 交错变为确定性（第二 probe 读到
   第一 probe 的 durable state，fingerprint 一致，不再 re-probe）。
2. **dsh-client 测试运行时 peer 实例化的非确定性（upstream 反馈候选）**：F1 的 peer 声明使
   pnpm 把 `dsh-client-test-runtime` 从旧 peer 邻集变体（32bb…）再实例化为全 peer 邻集变体（846f…），
   激活 `dsh-client-ui-layout` 的 `GlobalStandardProps` 模块增强（`usePanelInfo`）→ 7 个 client spec
   fixture 需要补一行 `usePanelInfo` 快照选择器（已做，`compatibility-peer.md` §5）。
   同一 peer 集合的不同"声明顺序/邻集路径"会产生不同变体哈希 → fixture 程序面随宿主 lockfile
   漂移。upstream 面候选：ui-layout 的全局增强应对"无宿主上下文"的 fixture 程序惰性/可选激活，
   或在 client 测试运行时锁定最小 peer 邻集（dedupe 行为不稳定，`dedupe-peer-dependents=false`
   实测无效——已验证记录）。
