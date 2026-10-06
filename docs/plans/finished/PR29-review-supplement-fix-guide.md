# PR #29 补充修复指导：DSH 0.1.7-rc.1 升级收口

> 目标仓库：`ArmourPiercer1/dsh-agent-team`  
> 目标 PR：#29  
> 当前分支：`task/dsh-017rc1-upgrade`  
> 当前目标宿主：DSH `0.1.7-rc.1` @ `46a7f68b0922371ce7144b668b90e377d8e799f4`  
> 本文用途：**PR #29 审查后的补充修复轮执行指南**  
> 本轮原则：**只修审查发现的兼容性缺口；不得扩展到 session-resume/B+、Team runtime 重构或 upstream 修改。**

---

# 0. 本轮目标

PR #29 主体升级工作已经完成，当前不需要重做 U0–U9。

本补充轮只处理以下 3 项：

1. **P1 / merge blocker**：根插件未声明 DSH peer compatibility，导致 0.1.7 新增的 plugin compatibility gate 实际没有约束本插件；
2. **P2**：client 解析了 `modeSelectionEnabled`，但创建 Team 时完全忽略该策略；
3. **P2/P3 边界问题**：当前 main-view session 推导只扫 `sessions.list.byId`，没有像 upstream `ui-session` 一样保留 `retainInfo(currentId)` 所证明的当前 session，存在 catalog-refresh/generation-replacement 窗口误清 Team open-mode mark 的风险。

完成后应：

- 不改变 Team durable schema；
- 不改变 Blueprint；
- 不修改 `team-spill-local` 架构；
- 不修改 session resume/restart；
- 不修改 DSH upstream；
- 保持 CORE PATCH BUDGET = 0；
- PR #29 可进入 merge-ready 状态。

---

# 1. F1 — 为根插件声明真实的 DSH 版本兼容范围

## 1.1 问题

PR #29 当前根 `package.json` 没有：

```json
"peerDependencies": {
  "@deepseek-ai/dsh": "..."
}
```

DSH 0.1.7 的 plugin compatibility preflight 明确只检查插件 manifest 中：

```text
peerDependencies["@deepseek-ai/dsh"]
peerDependencies["@deepseek-ai/dsh-*"]
```

如果没有 DSH peer，则 upstream 语义是：

```text
Missing DSH peers impose no constraint.
```

因此 PR 当前所谓：

```text
"plugin version-compat check 构造性通过"
```

实际只是：

```text
插件没有参加版本兼容检查
```

这不符合本插件当前已经明确针对 0.1.7 做 breaking-surface 迁移的事实。

## 1.2 修改文件

必须修改：

```text
package.json
```

建议添加：

```json
"peerDependencies": {
  "@deepseek-ai/dsh": "0.1.7-rc.1"
}
```

### 为什么建议先用 exact RC

当前插件已明确依赖 0.1.7 的以下行为：

```text
uiWorkspace.openSession
multi-instance client sessions
AgentPresetRegistry
agent/created + SessionStartSource
MCP SDK v2 path
session V4 environment
0.1.7 spill policy behavior
```

因此不要在本轮未经验证就声明：

```text
>=0.1.7
^0.1.7
*
```

也不要声明继续兼容 `0.1.5-rc.2`。

后续如果希望扩大兼容范围，应单独做 compatibility matrix。

## 1.3 必须新增 compatibility gate 测试

当前 U8 证据不够，因为现状是：

```text
没有 peer
→ compat checker 没有限制
→ install PASS
```

补充后必须证明：

### 正向

```text
plugin peer = 0.1.7-rc.1
runtime = 0.1.7-rc.1
→ compatible
→ 无 exact-version exemption
→ install / startup PASS
```

### 负向

至少构造一个不匹配 runtime：

```text
plugin peer = 0.1.7-rc.1
runtime != 0.1.7-rc.1
→ compatibility evaluator 拒绝
```

不要求真的启动一整套 0.1.5 host。

优先方案：

- 复用 upstream 0.1.7 的 compatibility evaluator/public test seam；
- 或在 downstream 新增一个小 fixture，直接验证 plugin manifest 对 compatibility checker 的输入输出。

禁止：

- 伪造字符串 grep 作为唯一测试；
- 用 `allow-version` exemption 让不匹配 case 通过；
- 只检查 `package.json` 字段存在，不检查 checker 行为。

## 1.4 git-install smoke 更新

更新 PR #29 的 U8 install 断言。

旧断言：

```text
root manifest 无 peerDependencies
→ compatibility gate 不施加约束
→ PASS
```

删除这种“通过”表述。

新断言应为：

```text
root manifest declares @deepseek-ai/dsh: 0.1.7-rc.1
running DSH = 0.1.7-rc.1
compatibility preflight accepts without exemption
```

日志中应确认：

```text
无 incompatible warning
无 allow-version exemption
无 compatibility.json grant
```

---

# 2. F2 — 正确处理 `modeSelectionEnabled`

## 2.1 问题

当前：

```ts
const result = await ctx.remote.agentPresets.list()

return result.value.presets
  .filter(...)
  .map(...)
```

虽然类型已包含：

```ts
modeSelectionEnabled: boolean
```

但此字段没有影响 Team 创建 UI。

结果是：

```text
modeSelectionEnabled = false
```

时，Team 创建 UI 仍然向用户显示/暴露普通 preset chooser。

这与 0.1.7 public roster contract 不一致。

## 2.2 upstream 语义

在目标 0.1.7-rc.1 tag 中：

```ts
interface AgentPresetRoster {
  presets: readonly AgentPresetRow[]
  modeSelectionEnabled: boolean
}
```

其语义：

```text
Whether visible mode selection is enabled for unnamed new sessions.
```

因此：

```text
false
```

至少意味着：

```text
不得继续呈现“用户可以自由选择模式/preset”的 UI
```

---

# 3. 建议实现方式：default-only

优先采用 **default-only** 策略，而不是把 roster 直接变成空数组。

## 3.1 目标行为

### `modeSelectionEnabled = true`

保持当前行为：

```text
返回所有 usable presets
允许 chooser
```

### `modeSelectionEnabled = false`

只暴露：

```text
usable && isDefault === true
```

的 preset。

UI 表现：

```text
不提供模式切换
默认 preset 自动选中
```

## 3.2 不要返回空 roster

不要实现成：

```ts
if (!modeSelectionEnabled) return []
```

因为这会把：

```text
chooser disabled
```

错误解释为：

```text
host 没有可用 preset
```

这两个状态语义不同。

## 3.3 建议修改点

主要文件：

```text
packages/client/src/plugin/team-mount-core.ts
```

当前：

```ts
listAgentPresets: async () => {
  const result = await ctx.remote.agentPresets.list()
  if (result.ok === false) throw ...
  return result.value.presets
    .filter(...)
    .map(...)
}
```

建议逻辑：

```text
usable = presets.filter(broken === undefined)

if modeSelectionEnabled:
    visible = usable
else:
    visible = usable.filter(isDefault)

return visible.map(...)
```

如果：

```text
modeSelectionEnabled = false
```

但不存在 usable default，则必须 fail-visible。

推荐：

```text
throw new Error(...)
```

或返回现有 UI 已能明确展示的 fatal/empty-state error。

不要：

```text
fallback 到第一个 usable preset
```

因为那会替 host 自行决定 policy。

---

# 4. F2 必须新增的 client tests

至少新增以下 focused cases：

## T1 — chooser enabled

输入：

```text
modeSelectionEnabled = true
usable presets = [standard, minimal]
```

期望：

```text
两个均返回
chooser 行为保持
```

## T2 — chooser disabled

输入：

```text
modeSelectionEnabled = false
standard.isDefault = true
minimal.isDefault = false
```

期望：

```text
只返回 standard
```

并确保 UI 不再表现为“可选多个 preset”。

## T3 — default broken

输入：

```text
modeSelectionEnabled = false
standard.isDefault = true
standard.broken = "..."
minimal usable
```

期望：

```text
不得 fallback 到 minimal
必须 fail-visible
```

## T4 — default missing

输入：

```text
modeSelectionEnabled = false
无 isDefault preset
```

期望：

```text
明确失败
```

---

# 5. F3 — 修复 main-view session retention race

## 5.1 问题

当前新增：

```ts
function currentMainSessionId(snapshot) {
  for (const summary of Object.values(snapshot.byId)) {
    if ((summary.retainedBy.mainView ?? 0) > 0) return summary.id
  }
  return null
}
```

这只能识别：

```text
当前 main-view session 同时存在于 sessions.list.byId
```

但 0.1.7 upstream 明确支持：

```text
retainInfo(id)
```

独立于 catalog membership。

upstream `ui-session` 的实现不是纯扫 `byId`，而是：

1. 先检查此前 current id；
2. 用：

```ts
sessions.retainInfo(currentId)
```

确认它是否仍被 `mainView` retain；
3. 只有旧 current 已不再 main-view 时，才从 `byId` 中寻找新的 main session。

## 5.2 当前风险

在：

```text
generation replacement
catalog refresh
client reconnect
host list 更新短窗口
```

中，可能出现：

```text
retainInfo(root).retainedBy.mainView = 1
但 root 暂时不在 list.byId
```

当前代码会：

```text
current = null
```

然后执行：

```ts
for (const root of openModeByRoot.keys()) {
  if (root !== current) openModeByRoot.delete(root)
}
```

导致当前 Team/ordinary mode mark 被错误清空。

---

# 6. 建议实现：与 upstream `ui-session` 对齐

不要重新发明状态模型。

直接镜像 upstream 0.1.7：

```text
keep last/current watched id
↓
先查 retainInfo(lastId).retainedBy.mainView
↓
仍 > 0 → 保留 lastId
↓
否则扫 list.byId 找新的 mainView id
↓
切换 retainInfo subscription
```

## 6.1 建议 helper 结构

可以把现有：

```ts
currentMainSessionId(snapshot)
```

升级为一个小 controller/helper，例如：

```text
resolveCurrentMainSessionId(previousId, listSnapshot, sessions)
```

或者把逻辑直接合入 effect。

关键不变量：

```text
last current id 仍被 mainView retain
→ catalog 暂时消失也不能清 open-mode
```

## 6.2 避免递归 subscription churn

当前代码：

```ts
retainInfo(current).subscribe(() => {
  if (watchedId === current) void reset()
})
```

而 `reset()` 内每次都会：

```text
dispose current retain watcher
重新 subscribe 同一个 id
```

虽然不一定出错，但容易形成无意义的 unsubscribe/resubscribe churn。

补充轮建议顺便调整为 upstream `watchMainRetention` 模式：

```text
if nextId === watchedId:
    do nothing
else:
    dispose old
    subscribe new
```

不要每次 list/retain notification 都重建同一 subscription。

---

# 7. F3 必须新增测试

至少新增以下 focused test。

## R1 — catalog disappearance but retain survives

初始：

```text
byId[root].retainedBy.mainView = 1
retainInfo(root).retainedBy.mainView = 1
openModeByRoot[root] = team
```

随后模拟：

```text
list.byId 暂时移除 root
retainInfo(root).mainView 仍 = 1
```

期望：

```text
current remains root
openModeByRoot[root] 不被清除
```

## R2 — retain 真正释放

继续模拟：

```text
retainInfo(root).mainView = 0
```

期望：

```text
current becomes null / next main id
旧 root open-mode mark 被清除
```

## R3 — A → B switch

```text
A mainView 1 → 0
B mainView 0 → 1
```

期望：

```text
A mark 清除
B 成为 current
无残留 watcher
```

---

# 8. 不要在本轮处理的事项

以下内容一律不得扩展：

```text
session-resume B/B+
restart restoration architecture
Session V4 migration redesign
TeamDomain schema
Blueprint revision
MCP multi-live-Team architecture
spill grant schema
permission FSM
leader wake semantics
upstream patch
```

如果执行过程中发现相关问题：

```text
记录到 post-upgrade-followups.md
```

不要修。

---

# 9. 推荐修改文件范围

预期主要只需要：

```text
package.json
packages/client/src/plugin/team-mount-core.ts
packages/client/test/client-plugin-mount.test.ts
可能的 creation UI focused test
U8 compatibility/install test 或 evidence kit
相关升级 evidence / summary
```

不应触及：

```text
packages/runtime/src/plugin/root.ts
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/runtime/src/plugin/team-spill-local.ts
packages/domain/**
packages/storage/**
Team lifecycle/FSM
```

除非出现与上述 3 finding 直接相关的、可证明不可避免的编译适配。

---

# 10. 测试顺序

## 10.1 Focused client tests

先跑：

```bash
pnpm --filter @dsh-agent-team/client typecheck
pnpm --filter @dsh-agent-team/client test
```

重点确认：

```text
modeSelectionEnabled=true
modeSelectionEnabled=false
broken default
missing default
mainView catalog-gap
mainView release
A→B switch
```

## 10.2 Compatibility focused test

验证：

```text
root peerDependencies 存在
0.1.7-rc.1 runtime → accepts
mismatch runtime → rejects
```

## 10.3 Static gates

重新执行：

```bash
pnpm typecheck
pnpm build
pnpm build:composition
pnpm check:artifacts
```

如果 `client-bundle.js` 因 client 源码变化漂移，必须同步提交生成产物。

随后：

```bash
node scripts/verify-zero-core.mjs --host tests/deepseek-harness-test-use
pnpm test
```

要求：

```text
新增失败 = 0
原 PRE_EXISTING failure set 不扩大
```

---

# 11. Real-host 回归

不需要重新设计整套 U8。

至少重跑：

## H1 — git-install compatibility

确认：

```text
plugin has @deepseek-ai/dsh peer
0.1.7-rc.1 install PASS
0 compatibility exemption
0 incompatibility warning
```

## H2 — New Team preset

真实 host 下确认：

```text
agentPresets roster 读取正常
default preset 正常
Team 创建正常
```

如果实际 profile：

```text
modeSelectionEnabled
```

在 0.1.7 发布包中已经属于 retired/ignored 字段，则必须在 evidence 中说明：

```text
代码仍按 public wire shape fail-safe 支持；
真实 host 当前默认路径不触发 false；
focused test 负责锁定兼容行为。
```

注意：如果进一步核对目标 tag 后确认发布版的最终 registry 已经移除了 `modeSelectionEnabled`，则不要盲目强化一个已退役字段；应以 **目标 tag 实际 remote wire** 为最终 authority，并相应修正文档/类型/测试。必须记录 source/tag 证据。

## H3 — client session switching

至少验证：

```text
ordinary → Team
Team → ordinary
两个 session 切换
reload/reconnect 后 Team view 不误丢 mode mark
```

---

# 12. Evidence 更新

建议新增：

```text
dev/agent-workflow/evidence/dsh-017rc1-upgrade/review-supplement/
```

至少包含：

```text
compatibility-peer.md
client-preset-policy.md
client-main-retention.md
focused-tests.log
static-gates.log
real-host-smoke.md
```

并更新：

```text
upgrade-summary.md
failure-classification.md
post-upgrade-followups.md
```

---

# 13. 最终验收条件

## G-S1

根插件 manifest：

```text
明确声明 DSH compatibility peer
```

且：

```text
0.1.7 runtime accept
mismatch runtime reject
```

## G-S2

preset policy：

```text
chooser enabled → 多 preset
chooser disabled → default-only
broken/missing default → fail-visible
```

## G-S3

main-view retention：

```text
catalog 暂时消失 + retainInfo mainView 仍有效
→ 不清 Team mode
```

且：

```text
retain 真释放
→ 正确清理
```

## G-S4

全量：

```text
typecheck PASS
build PASS
build:composition PASS
check:artifacts PASS
zero-core PASS
client suite PASS
full-suite 无新增失败
```

## G-S5

real-host：

```text
git-install compatibility PASS
New Team PASS
session switching PASS
```

---

# 14. 补充轮提交建议

建议控制在 2–3 个提交：

```text
fix(compat): declare dsh 0.1.7 runtime peer compatibility
fix(client): honor preset policy and preserve main-session retention
test(upgrade): close PR29 review findings on real 0.1.7 host
```

不要把历史 evidence 大规模重写。

---

# 15. 最终裁决标准

如果上述三项全部关闭，并且没有引入新的 production regression，则：

```text
PR #29 → MERGE-READY
```

如果 F1 未修：

```text
仍不建议合并
```

因为这意味着 0.1.7 新增的插件版本兼容保护对 dsh-agent-team 实际无效。

如果 F2/F3 仍未修，但已有充分证据证明目标 tag 的实际 public wire/first-party behavior 与当前判断不同，应提交：

```text
source-backed contradiction note
```

并据实际 0.1.7 tag 修正方案，而不是为了满足本文机械修改。
