# dsh-agent-team 0.1.5-rc.2 → 0.1.7-rc.1 宿主升级 — upgrade-summary

日期：2026-09-24 · 执行：`task/dsh-017rc1-upgrade`（worktree `.worktrees/dsh-017rc1-upgrade`，本地分支，**未 push**）
计划：`docs/plans/active/dsh-agent-team-0.1.7-rc.1-upgrade-plan.md`（U0–U9 + Gate G1–G7）
**VERDICT: COMPLETE — 全部 U0–U9 交付，G1–G7 全过，零 upstream 修改（CORE PATCH BUDGET = 0 保持）**

## 1. 最终裁决

| Gate | 判据 | 结果 | 证据 |
| --- | --- | --- | --- |
| G1 | 版本一致性 | **PASS** | test-use == `46a7f68b09`（0.1.7-rc.1 官方发布点，PR #5073）；9 包 manifest 扫描：全部 `@deepseek-ai/dsh*` 直接依赖 == 0.1.7-rc.1，0 个 0.1.2/0.1.5 pin（cordis-plugin-* 3 个 devDep 属独立 cordis loader 家族，0.1.5 图同版本） |
| G2 | 静态闸 | **PASS** | U7 + U9 终核：clean install（frozen-lockfile）exit 0 / typecheck 9 包 8/8+client / build + build:composition + check:artifacts **OK 1172 零漂移** / zero-core host-only **0 findings** + 9 包 C4 1031 findings 全部仓内（0 进 host 树）/ public-import scanner 零 denylist 词（p4t6 **@747** 10/10） |
| G3 | 核心插件 | **PASS** | U8 实宿主垂直 run-11 **75/75**：host loads（V0）/ client loads（V0 client row active）/ Team creates（V2 fresh-root + durable projection teamRows=25）/ member creates（V2/V3）/ Team tools execute/return（V3 delegate/send_message/report_progress）/ permission enforcement correct（V4 allow/deny/ask 三 lane 端到端）/ MCP initial grant correct（V5 三变体） |
| G4 | Spill | **PASS** | U8 V6 8/8：单一 spillStore provider（V0 base disabled + team-spill-local active + 无 duplicate）/ 0.1.7 **token-budget** spill 触发（250KB @ maxInlineTokens:12500，notice+locator，无 byte threshold）/ managed Team grant 工作（owner 读 auto-admitted，durable `artifact-read-granted` fact 磁盘实证）/ cross-instance deny 工作（member 读 = envelope fail-closed 拒绝）/ unmanaged 行为保持 upstream-equivalent（V6b 拒绝路径 = 0.1.7 默认 ask lane + envelope 边界，无插件介入改变） |
| G5 | Client | **PASS** | V0 client row active + V1 普通会话不受影响（26 tools standard 面）+ V2/V3 Team UI 数据面（New Team 路径 + 成员链）+ client 套件 **47/47 文件 649/649 测试全绿**（多实例 client session API 无串线 = U5 typecheck + 套件覆盖） |
| G6 | 实宿主 | **PASS** | fresh pristine 0.1.7-rc.1 world（`tests/homes/u8-017rc1-2026-09-24T14-48-13`）通过 V0–V8 全部 legs（11 次迭代运行，run-11 定稿 exit 0；中间运行 = 0.1.7 差异发现史，全留档 `u8/vertical.log`） |
| G7 | 回归核算 | **PASS** | 根套件 10F\|20F\|3822P(3842) vs baseline dc6fb6f 10F\|20F\|3817P(3837)：**失败集逐文件逐测试相同**（+5 = U6 新增套件全绿），A=20 测试（PRE_EXISTING）/B=∅/C=∅/D=∅（V8 实测 resume 正常，仍按 §17 单列 F1）；零"原因未知的新失败" |

## 2. 轮次提交链（本地，未推送）

```text
dc6fb6f  ← master 基线（U0 记录点）
bf33544  U0+U1  test-use pin 0.1.7-rc.1 + DSH 包图统一 0.1.7-rc.1
5546f6d  U2–U5  preset fixture/registry 迁移 + agent lifecycle 适配 + client sessions/slots 类型适配 + spill 迁移
db99dbe  U6     mini-MCP 三变体 harness + 回归套件 + p4t6 746 + mcp-regression.log
d09c010  —      test-infra：client devDeps zustand+immer（published dsh-client-store 未声明依赖 quirk）
becd759  —      U7.3 client-bundle 重同步（U5 源变更后的 check-artifacts 强制）
adad20c  U7     mini-mcp.d.mts + p4t6 747 + static-gates.log
（U8/U9）待提交  u8 证据目录（vertical.mjs kit + 11 次运行证据 + vertical-summary + U3 复测）+ failure-classification + post-upgrade-followups + 本文件 + 簿记
```

## 3. 各 U 项交付摘要（证据指针 = `dev/agent-workflow/evidence/dsh-017rc1-upgrade/`）

| U | 交付 | 关键结论 | 证据 |
| --- | --- | --- | --- |
| U0 | baseline 固化（dc6fb6f 全量 + 失败集）+ test-use pin 0.1.7 | baseline = 10F\|20F\|3817P(3837)，失败集 10 文件逐一记录 | `baseline-canonical-dc6fb6f.log` |
| U1 | DSH 包图统一 0.1.7-rc.1（runtime/client/remote/legacy manifest + lockfile） | 零 0.1.2/0.1.5 残留 | `dependency-diff.md` |
| U2 | preset fixture/registry 0.1.7 迁移 | 0.1.7 preset 面变化全部适配 | `preset-migration.log` |
| U3 | agent lifecycle characterization 适配（0.1.7 `agent/created`+`source` 词汇，`agent/session-start` 缺席）+ U8 复测 | 探针复测 20P/14F，14F 全部归因 0.1.7 session 面两项变化（V4 日志命名 + `session.events` 弃用），**非插件回归**；5546f6d re-pin 词汇预测成立 | `u8/lifecycle-probe/` + `vertical-summary.md` (d) |
| U4 | spill 迁移（0.1.7 token-budget 语义核验） | LocalSpillStore 构造面 SAME；spill-policy 触发面 = maxInlineTokens 12500（published lib stale quirk 留痕 F2） | `spill-migration.log` |
| U5 | client sessions/slots 0.1.7 类型适配 | client 套件 47/47 全绿 | `client-sessions-migration.log` + client 套件日志 |
| U6 | MCP 0.1.7 回归（seam 表 + 三变体 unit + 发布件依赖 quirk 扫描） | mcp-client reconnect/supervisor/scoped-registry 面记录；根套件零新增失败 | `mcp-regression.log` |
| U7 | 静态闸全绿（clean install/typecheck/build/composition/artifacts/zero-core/public-import） | 10.1–10.5 全 PASS，OK 1172 零漂移 | `static-gates.log` |
| U8 | **pristine 0.1.7 real-host vertical**（git-install + V0–V8 + U3 复测） | **75/75**（run-11）；15 项 0.1.7 差异全记录（零 upstream 修改，仅 task kit + mock harness 适配）；V8 Team resume 六次全 PASS（load-only re-adopt） | `u8/vertical-summary.md` + `u8/run/summary.json` |
| U9 | 全量测试 + A–D 分类 + 终核 proof + follow-ups | 零新增失败；zero-core/pristine/G1 终核 | `failure-classification.md` + `post-upgrade-followups.md` |

## 4. 0.1.7 新行为面（本轮实证，详见 `u8/vertical-summary.md` (c)）

1. **plugin version-compat check**：`peerDependencies` 驱动（semver includePrerelease，fail-closed + `allow-version --accept-risk` 豁免）；U8 时点本插件无 peers → 构造性通过（无约束）——**该缺口已由 PR29 review-supplement 轮 F1 闭合**：根 manifest 现声明 `peerDependencies["@deepseek-ai/dsh"] = "0.1.7-rc.1"`，门从"因缺失而通过"变为"对真实 range 求值"；新世界的 git-install 复证（`review-supplement/real-host-smoke.md` H1）= 0.1.7-rc.1 运行时无豁免通过 + 0.1.5-rc.2 反事实 RAISE issue（门现真正约束本插件）。
2. **compat preflight 对 nameless profile-override row 崩溃**（0.1.7 新特性真 bug，上游候选）：`manifestOf` 未 guard `row.name === undefined` → 配置覆盖行（无 name）被静默禁用 + 误导性 denial；named row 正常（rc2 kit 模式成立）。
3. **remote session API**：无 auto-create（显式 `POST /api/session/create`）；`session/prompt` accept 即返回（turn 异步）。
4. **LLM wire 协议**：OpenAI chat-completions → DeepSeek Messages API（Anthropic 风格 block + SSE；mock harness 已双协议化，commit 内 `packages/tools/harness/mock-deepseek.mjs`）。
5. **session log V4**：`session.v4.jsonl.zstd` = 串联 zstd 帧流（多帧解码器资产 `u8/u8-live-state/decode-v4.mjs`）。
6. **repetition guard**：完全相同 tool call 重发 → 注入 user 提示并结束 turn。
7. **`tools.restrict()` 校验名**：per-agent own-layer 名（`subagent`）exempt，deny 面须过滤（插件 follow-up F6-2）。
8. **bash 必填 `description`**。
9. **`requestToken` = work-unit 幂等键**：重放 = `WORK_REPLAYED` 静默 no-op（成员不被再唤醒）。
10. **p6t6 control feed per-team-root scoped**：created team 的 pending approvals 只在 durable fact store（双编码行）可见（插件 follow-up F6-3）。
11. **spill notice locator 后紧跟 `. `**（尾点陷阱，kit 已适配）。
12. **domain-store 批量 flush**：fact 文件在 domain commit 时重写（非 per-fact）——读回须跟随后续 domain 操作 + 短轮询。
13. **member ask-lane ops 对 mutation envelope fail-closed**（`request-control` 在成员 envelope 外 → 错误即工具结果，无 pending approval）。
14. **team.create 响应时机**：initial work admit+settle 即 resolve（不等 leader turn idle）。
15. **mcp-client**：初始尝试 fail-closed 保持；运行期断连自动重连 ≤10（本轮未触发，无断连）。

## 5. POST-UPGRADE FOLLOW-UPS（完整登记 `post-upgrade-followups.md`）

- **F1 session-resume / restart**（plan 强制单列）：V8 实测六次全 PASS（load-only re-adopt + V4 日志），**但不得声称 B/B+ resume 架构问题已解决** —— 0.1.7 新基线下的 resume 重分析 + U3 fixture 重录 = 独立轮次。
- **F2 发布件打包 quirk**：dsh-client-store 未声明 zustand/immer（本地已补 devDeps）；dsh-spill-policy lib stale `maxInlineBytes` 面 → upstream 反馈候选。
- **F3 0.1.7 行为面注记**：mcp reconnect / scoped serverName / compat gate 空 peers 建议声明 → **该建议已由 PR29 review-supplement 轮 F1 闭合**（声明精确 RC peer `0.1.7-rc.1`，门从"因缺失而通过"变为对真实 range 求值；新世界复证见 §7）。
- **F4 test-infra 加固**：a2c7 pinned-lib 依赖显式化；test-use 换基线 = 完全重置协议（本轮两次构建失败的教训）；pnpm store 沙箱 XDG 重定向注记；characterization fixture 重录。
- **F5 基线 test debt**：10 文件/20 测试 PRE_EXISTING（t1 YAML 解析值得独立定位）。
- **F6 U8 专项 10 项**：upstream compat-preflight bug 报告 / 插件 restrict 包装容错 / created-team approvals 可见性 / requestToken 文档 / 0.1.7 automation 断裂面（session API + wire + bash description）/ domain-store flush 延迟 / member envelope 拒绝模式 / kit 资产升格 tests/kits/ / 沙箱 boot-log 落盘延迟根因 / U3 0.1.7 重基线。

## 6. 红线守纪（全轮）

- upstream 源码零修改（CORE PATCH BUDGET = 0；15 项差异全部 task-kit/插件侧适配或 follow-up 登记）。
- 零 push（本轮无推送授权；`task/dsh-017rc1-upgrade` 本地保留）。
- :3080 / :3180 全程只读探测 pre==post（401==401，U8 closing 双证）。
- test-use 每 leg 后 + 终核：porcelain 空 + HEAD `46a7f68b09`（U8 closing + U9 终核双证）。
- 冻结锚点 `a3ab319927` / `fb2c4b9e69` 未移动；references/ 零触碰。
- 端口 3491/3496–3499 释放；12 个 U8 world 留档（`tests/homes/u8-017rc1-*`，gitignored，§7 登记于 vertical-summary 头部）。
- 未触碰其他 worktree；worktree 内 `tests/deepseek-harness-test-use` symlink 未入库。

## 7. PR29 review-supplement 轮（2026-09-25，本 upgrade 的 review 修复轮）

来源：`docs/plans/active/PR29-review-supplement-fix-guide.md`（用户指定，只读）——PR #29 评审补轮：闭合 3 项发现（F1 merge blocker / F2 / F3），G-S1–G-S5 闸。

| 项 | 闭合方式 | 证据 |
| --- | --- | --- |
| **F1**（merge blocker）根 manifest 无 dsh peer → 0.1.7 compat 门从未约束本插件 | 声明 `peerDependencies["@deepseek-ai/dsh"] = "0.1.7-rc.1"`（精确 RC，review 裁决）；lockfile 再解析（版本多集 diff = 恰 +1 伞宿主树，integrity 348→793 全为伞树不可变 tarball，余为 peer-suffix 实例 churn 语义中性）；新 compat 套件 7/7（真宿主 evaluator：0.1.7-rc.1 接受 / 0.1.5-rc.2 RAISE issue 带 `name@version` 键 / 0.1.7-rc.2 精确性 unmet / peerless 双 runtime 不受约束 / exemption 路径）；**新世界 git-install 复证**（H1：installed manifest 带 peer + 宿主自身 evaluator 接受 + 0.1.5-rc.2 反事实 RAISE + pre-supplement 形态不受约束 = 门现真正生效） | commit 1a3a3ad + `review-supplement/compatibility-peer.md` + `h1-peer/evaluation.json` |
| **F2** client 解析 `modeSelectionEnabled` 但 Team 创建 preset roster 忽略之 | `listAgentPresets` 应用宿主策略：visible = modeSelectionEnabled ? usable : usable∩{isDefault}；disabled 且无 usable default → **fail-visible throw**（记录与 upstream section/seat-store 内部 first-usable fallback 的有意分歧）；T1–T4 mount 测试；**实宿主 wire 实证**（H2：fresh world `agentPresets/list` 返回 `modeSelectionEnabled=true` + 4 presets，F2 策略产出非空 visible roster） | commit 730f83b + `review-supplement/client-preset-policy.md` + `h2-roster/roster-summary.json` |
| **F3** main-view 会话推导只扫 byId（无 retainInfo-first）→ 目录刷新/代际更替窗口误清 Team open-mode 标记 | `resolveCurrentMainSessionId`（retainInfo-first → byId 扫描，镜像 upstream ui-session 模式）+ open-mode reset effect churn guard（同 id 目录抖动不再 dispose watch；真更换才重订阅）；R1–R3 mount 测试；**实宿主 wire 实证**（H3：boot main + created team root + fresh ordinary session 三行共存无丢失；**第二个 launch-token cookie = 真新连接**下目录相同；wire 行 `retainedBy` shape 记录在案；retainInfo 本身 = client-context service 无 wire RPC——源验证，open-mode 不变量由 R1–R3 锁定） | commit 730f83b + `review-supplement/client-main-retention.md` + `h3-sessions/` |

**G-S 闸（supplement 静态闸 + 实宿主）**：

- G-S1 静态：root typecheck 9 包全绿 / build + build:composition + check:artifacts（client-bundle.js 随 commit 730f83b 同步）/ zero-core 0 findings / compat 7/7 + client 47/47|656/656。
- G-S2 回归：根套件确定性底 **10F|20F|3836P(3856)**（+14 = 7 compat + 7 client；失败集与 baseline F0 逐文件逐测试名相同）；client 套件 47/47|656/656。
- G-S3 实宿主：H1–H3 全 PASS（fresh world `tests/homes/rs-017rc1-<stamp>`，`review-supplement/real-host-smoke.md`）。
- G-S4 零 upstream 修改：test-use 保持 pristine @ `46a7f68b09`（冒烟前后双证）；guide 范围纪律 = 仅 3 发现 + 指定测试/证据；唯一范围外编译适配 = 7 fixture `usePanelInfo` 一行（可证明不可避免，因果链 `compatibility-peer.md` §5）。
- G-S5 留痕：3 个 living 文档更新（本文件 §7 + F3 行、`failure-classification.md` supplement delta、`post-upgrade-followups.md` F3 闭合 + F7 新发现）；p6t1-parallel 既有竞态（类 E）全矩阵归因 `review-supplement/p6t1-flake-attribution.md`（本轮不修——修复在 runtime compatibility 链，超 guide 文件范围）。

**supplement 提交**（本文件 §2 提交链之后）：`1a3a3ad` fix(compat) → `730f83b` fix(client) → `<evidence-commit>` test(upgrade): close PR29 review findings on real 0.1.7 host。
