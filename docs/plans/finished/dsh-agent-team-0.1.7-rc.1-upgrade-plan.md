# dsh-agent-team：DSH 0.1.5-rc.2 → 0.1.7-rc.1 升级实施方案

> 目标仓库：`ArmourPiercer1/dsh-agent-team`  
> 当前宿主基线：DSH `0.1.5-rc.2` @ `fb2c4b9e698e30edb738bca4cf0618587db7d203`  
> 目标宿主基线：DSH `0.1.7-rc.1` @ `46a7f68b0922371ce7144b668b90e377d8e799f4`  
> 编写日期：2026-09-24  
> 本轮范围：**只做宿主版本升级与兼容适配，不解决 session-resume/restart 既有问题，不借机改架构，不修改 DSH upstream。**

---

## 0. 本轮原则与边界

### 0.1 唯一目标

使当前 `dsh-agent-team` 在 pristine DSH `0.1.7-rc.1` 上满足：

1. 可以安装、构建、启动；
2. bundle patch 能正确装载；
3. Team host/client 能注册；
4. New Team → leader/member → tools/MCP → stop 的主路径可运行；
5. strict-read + `team-spill-local` replacement 仍保持原语义；
6. 现有权限治理、Blueprint、lifecycle、leader wake、MCP initial grant 等功能不因升级发生未解释漂移；
7. 测试基线从 `0.1.5-rc.2` 正式迁移到 `0.1.7-rc.1`。

### 0.2 明确不做

本轮不得：

- 解决“DSH 进程重启后已有 Team 无法恢复”的 session-resume 问题；
- 实施此前讨论的 B/B+ session resume replacement；
- 修改 upstream DSH 源码；
- 引入新的 Team durable schema；
- 重构 Team FSM / lifecycle；
- 重新设计 Blueprint；
- 为兼容新版 DSH 而采用 DOM hack / private client store / private subpath；
- 顺手接入 upstream experimental Agent Team；
- 改变现有 0-core 原则；
- 把 characterization 历史 evidence 机械重写成新版本。

如果升级暴露 restart/resume 缺陷，只登记为 **POST-UPGRADE FOLLOW-UP**，不得在本 PR 中处理。

---

# 1. 已确认的 upstream 变化

DSH `0.1.7-rc.1` release tag：

```text
dsh-v0.1.7-rc.1
46a7f68b0922371ce7144b668b90e377d8e799f4
```

旧基线：

```text
dsh-v0.1.5-rc.2
fb2c4b9e698e30edb738bca4cf0618587db7d203
```

官方 `0.1.7-rc.1` release notes 明确包含以下与本插件直接相关的 breaking/change surfaces：

1. Agent preset 从旧目录模型迁移到 plugin-composition 声明模型；
2. `@deepseek-ai/dsh-agent-presets` 旧体系迁移为
   - `@deepseek-ai/dsh-agent-preset`
   - `@deepseek-ai/dsh-agent-preset-registry`
3. settings 迁移到当前 Profile 的插件配置；
4. `agent/session-start` 被异步串行 `agent/created` 取代；
5. Session 同步历史接口 `snapshotEvents` / `eventAt` / `ownEvents` 弃用；
6. Session log 升级 V4；
7. Client Session 支持多实例，相关 API / slots 有变化；
8. MCP 升级到官方 SDK v2；
9. tool spill/retention 从 byte budget 改为 estimated-token budget，
   自定义 `spill-policy.maxInlineBytes` → `maxInlineTokens`；
10. 插件安装/启动新增 DSH version compatibility 检查；
11. source launch / linked local plugin 的 module resolution 有 upstream 修复；
12. upstream experimental Team 工具发生变化，但本项目不应与其耦合。

本仓库当前代码实查还存在两个关键事实：

- `packages/runtime/package.json` 的 DSH 依赖仍混合 pin：
  - 大量 `0.1.2-rc.1`
  - `dsh-spill` / `dsh-spill-local` 为 `0.1.5-rc.2`
- `packages/client/package.json` 的 DSH client packages 仍全部 pin `0.1.2-rc.1`

因此本轮第一原则是：

> **禁止继续混用 0.1.2 / 0.1.5 / 0.1.7 的 DSH package graph。所有实际被本插件编译或运行消费的 DSH packages 必须统一到 0.1.7-rc.1。**

---

# 2. 任务 DAG

建议建立单独升级分支，例如：

```text
task/dsh-017rc1-upgrade
```

内部按以下顺序执行：

```text
U0  固定新 upstream 基线并生成差异清单
 ↓
U1  依赖图统一到 0.1.7-rc.1
 ↓
U2  Agent Preset / Profile 兼容
 ↓
U3  Agent lifecycle event 兼容
 ↓
U4  spill replacement 兼容
 ↓
U5  Client API / slots 兼容
 ↓
U6  MCP / capability surface 重新定征
 ↓
U7  构建、静态门禁与单元测试
 ↓
U8  pristine 0.1.7 real-host vertical
 ↓
U9  全量回归、差异分类与文档收口
```

除非 U0/U1 发现 public seam 已不存在，否则禁止提前设计 adapter。

---

# 3. U0 — 固定 upstream 0.1.7-rc.1 基线

## 3.1 更新 test-use checkout

目标：

```text
tests/deepseek-harness-test-use
```

执行：

```bash
git -C tests/deepseek-harness-test-use status --porcelain
git -C tests/deepseek-harness-test-use fetch --tags origin
git -C tests/deepseek-harness-test-use checkout --detach \
  46a7f68b0922371ce7144b668b90e377d8e799f4
git -C tests/deepseek-harness-test-use status --porcelain
git -C tests/deepseek-harness-test-use rev-parse HEAD
```

必须满足：

```text
porcelain == empty
HEAD == 46a7f68b0922371ce7144b668b90e377d8e799f4
```

不得向 test-use 写 downstream 修复。

## 3.2 修改 `tests/paths.mjs`

修改：

```js
TEST_USE_BASELINE_SHA
CLIENT_COMMIT_HASH
```

从：

```text
fb2c4b9e698e30edb738bca4cf0618587db7d203
fb2c4b9e69
```

改为：

```text
46a7f68b0922371ce7144b668b90e377d8e799f4
46a7f68b09
```

同时修改注释中的 baseline history，追加：

```text
fb2c4b9e69 (0.1.5-rc.2)
→ 46a7f68b09 (0.1.7-rc.1, 2026-09-24)
```

不要删除旧版本历史。

## 3.3 修改基线文档

至少更新：

```text
AGENTS.md
docs/TEST_METHODS.md
```

把“当前支持基线”从 `0.1.5-rc.2` 更新为 `0.1.7-rc.1`。

历史 evidence 中出现 `0.1.5-rc.2` 的内容不改。

`.agents/skills/**` 内如果文字是在描述“经 0.1.5-rc.2 实测的特定行为”，本轮先保留历史措辞；只有重新在 0.1.7 实测后，才追加新的 0.1.7 结论，禁止直接把版本字符串替换掉。

## 3.4 建立升级专用 seam inventory

新增一份 evidence，例如：

```text
dev/agent-workflow/evidence/dsh-017rc1-upgrade/upstream-seams.md
```

实际读取 0.1.7 源码并记录以下 public surfaces 是否存在、package path、方法签名：

```text
agents.create
agents.resume
agent/created
session/created
session/event
agentPresets.list
agentPresets.resolve
agentPresets.mount
agentPresets.composeFrom
agentPresets.composedPreset
remote.agentPresets.list
sessionProjections
sessionQuery
storageDomain
spillStore
LocalSpillStore
SaveTextSpill
SpillSource
mcp-client
client slots consumed by dsh-agent-team
```

输出三态：

```text
SAME
CHANGED
ABSENT
```

如果任何 production-required seam 为 `ABSENT`，停止该子任务并写清楚 blocker；不要自行改用 private API。

---

# 4. U1 — 统一 DSH package graph

这是本轮必须做的第一处真实代码修改。

## 4.1 `packages/runtime/package.json`

当前存在：

```json
"@deepseek-ai/dsh-agent": "0.1.2-rc.1",
"@deepseek-ai/dsh-llm": "0.1.2-rc.1",
"@deepseek-ai/dsh-mcp-client": "0.1.2-rc.1",
"@deepseek-ai/dsh-session": "0.1.2-rc.1",
"@deepseek-ai/dsh-spill": "0.1.5-rc.2",
"@deepseek-ai/dsh-spill-local": "0.1.5-rc.2",
"@deepseek-ai/dsh-storage-domain": "0.1.2-rc.1"
```

以及 devDependencies 中多项 `0.1.2-rc.1`。

### 修改原则

所有仍存在且直接消费的 DSH package 统一 pin：

```text
0.1.7-rc.1
```

至少覆盖：

```text
@deepseek-ai/dsh-agent
@deepseek-ai/dsh-agent-loop
@deepseek-ai/dsh-llm
@deepseek-ai/dsh-mcp-client
@deepseek-ai/dsh-session
@deepseek-ai/dsh-session-projection
@deepseek-ai/dsh-scope
@deepseek-ai/dsh-skill
@deepseek-ai/dsh-system-prompt
@deepseek-ai/dsh-tools
@deepseek-ai/dsh-spill
@deepseek-ai/dsh-spill-local
@deepseek-ai/dsh-storage-domain
```

### Agent preset dependency

删除：

```text
@deepseek-ai/dsh-agent-presets
```

不要机械替换成旧概念同名包。

根据实际 import / typecheck 需要添加：

```text
@deepseek-ai/dsh-agent-preset-registry: 0.1.7-rc.1
```

如果只通过 Cordis `ctx.agentPresets` 使用服务且不需要静态类型 import，则不要额外添加不需要的 dependency。

仅当测试/fixture 需要声明 preset composition 时再添加：

```text
@deepseek-ai/dsh-agent-preset: 0.1.7-rc.1
```

## 4.2 `packages/client/package.json`

当前所有 DSH client packages 仍是 `0.1.2-rc.1`。

先把仍存在的这些 package 统一 pin 到：

```text
0.1.7-rc.1
```

包括：

```text
@deepseek-ai/dsh-client-locale
@deepseek-ai/dsh-client-store
@deepseek-ai/dsh-client-test-runtime
@deepseek-ai/dsh-client-ui-conversation
@deepseek-ai/dsh-client-ui-primitives
@deepseek-ai/dsh-client-ui-slots
```

若其中有 package 被 upstream 改名/拆包，以 **0.1.7 的 public package** 为准迁移 import，不得通过旧版 package 保持编译。

## 4.3 Cordis vendor 依赖

不要预设继续使用：

```text
cordis 4.0.2
cordis-plugin-group 1.0.2
cordis-plugin-include 1.0.7
cordis-plugin-loader 1.0.3
```

从 `0.1.7-rc.1` upstream 对应 package.json 读取实际 vendor versions。

若 0.1.7 使用同 minor 的 patch 更新，则将本项目同步到 upstream 实际版本。

目的：避免“DSH package 已 0.1.7，但本项目类型系统仍绑定旧 Cordis API”的假兼容。

## 4.4 lockfile

执行：

```bash
pnpm install --lockfile-only
pnpm install
```

随后检查：

```bash
grep -R "0.1.2-rc.1" packages/*/package.json
grep -R "0.1.5-rc.2" packages/*/package.json
```

要求：

- production/dev package manifests 不再混入旧 DSH 版本；
- 历史 evidence 不要求清理；
- lockfile 中旧版本若只由其他第三方 transitively 需要，可以存在，但必须说明来源；
- 本项目直接声明的 DSH package 必须全部指向 0.1.7-rc.1。

---

# 5. U2 — Agent Preset / Profile 迁移

## 5.1 不改 production 的 `agentPresets` 核心调用

当前 production/harness 依赖的主要 seam：

```text
agentPresets.resolve
agentPresets.mount
agentPresets.composedPreset
agentPresets.composeFrom
remote.agentPresets.list
```

在 0.1.7 registry 中这些核心概念仍存在。

因此：

**禁止为了升级而重新实现 Team preset system。**

优先保持：

```text
packages/runtime/src/plugin/host.ts
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/client/src/plugin/*
```

现有调用方式，仅根据 TypeScript / runtime signature 的真实变化做最小修改。

## 5.2 修改旧 package 名注释

以下文件存在旧 package 名：

```text
packages/runtime/root-binding/harness/plugin.mjs
packages/runtime/member-residency/harness/plugin.mjs
```

把文档注释：

```text
@deepseek-ai/dsh-agent-presets
```

改为：

```text
@deepseek-ai/dsh-agent-preset-registry
```

这只是文档准确性修复，不改变 runtime。

## 5.3 删除 `.agent-presets` 目录式 fixture 假设

搜索：

```bash
git grep -n "\.agent-presets"
git grep -n "agent.cordis.yml"
```

重点处理 characterization / real-host fixture 中“向 `$DSH_HOME/.agent-presets/...` 写文件然后期待自动发现”的逻辑。

0.1.7 不再以该目录为 preset registration authority。

### 新 fixture 方式

需要自定义 preset 的测试，应通过 profile/plugin composition 声明：

```yaml
- insert:
    - id: <test-preset-row>
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: <preset-id>
        name: <display-name>
        plugins:
          ...
```

实际 YAML schema 必须直接按 `0.1.7-rc.1` 的：

```text
packages/preset/agent-preset
packages/preset/agent-preset-registry
```

源码生成，不凭记忆手写。

## 5.4 New Team preset UI

重新验证：

```text
ctx.remote.agentPresets.list()
```

0.1.7 registry roster 重点字段：

```text
presets[]
modeSelectionEnabled
id
name
description
order
broken
isDefault
```

检查：

```text
packages/client/src/plugin/team-mount-core.ts
packages/client/src/ui/NewTeamEntry.tsx
```

如果当前 parser 假设旧 roster shape：

- 只改 adapter/type；
- 不改变 Team blueprint schema；
- `broken` preset 仍应 fail-visible；
- `modeSelectionEnabled=false` 时不得假装 chooser 可用。

新增/更新 focused client test：

```text
0.1.7 roster 正常
broken preset
modeSelectionEnabled false
default preset
empty roster / remote failure
```

---

# 6. U3 — Agent lifecycle event 迁移

官方变化：

```text
agent/session-start
→ async serial agent/created
```

## 6.1 production search

执行：

```bash
git grep -n "agent/session-start" -- ':!dev/agent-workflow/evidence/**'
```

目前已知主要命中集中在 characterization，而不是 production Team runtime。

### 若 production 无命中

不要新增任何 compatibility shim。

只修改 characterization / seam expectations。

### 若发现 production listener

把依赖 `agent/session-start` 的初始化迁移到：

```text
agent/created
```

并显式 `await`/适配其串行异步语义。

必须确认：

- first model request 不早于 Team binding / capability setup；
- listener failure 的 rollback 行为与现有 Team 预期一致；
- 不重复执行同一初始化。

## 6.2 characterization 更新

重点：

```text
tests/characterization/probes/agent-lifecycle/plugins/lifecycle-host.js
```

旧顺序类似：

```text
session/created
agent/created
agent/session-start
binding-attach
...
```

升级后重新实测 0.1.7 的真实顺序。

不要简单删除一行让测试变绿。

重新记录：

```text
fresh root
fresh member
cold create path（仅创建/加载 API 兼容测试）
setup-before-publication ordering
agent/created listener completion ordering
```

注意：

> 本任务只确认 create/resume API 在 0.1.7 仍可被 Team 使用，不调试“跨 DSH restart 后 Team resume 失败”。

---

# 7. U4 — `team-spill-local` replacement 兼容

这是本项目最重要的定制 compatibility surface。

当前：

```ts
export class TeamAwareLocalSpillStore extends LocalSpillStore
```

并 override：

```ts
saveText(input: SaveTextSpill): Promise<SpillRef>
```

0.1.7-rc.1 upstream 实查：

- `LocalSpillStore` 仍存在；
- config 仍包含：
  - `root?: string`
  - `cleanupPeriodDays?: number`
- `saveText(input: SaveTextSpill): Promise<SpillRef>` 仍存在；
- cleanup sweep 仍由 upstream 实现；
- service name 仍为 `spillStore`。

因此当前 replacement 架构**原则上可以继续使用**。

## 7.1 必做 source-union fingerprint

读取 0.1.7：

```text
@deepseek-ai/dsh-spill/types
SaveTextSpill
SpillSource
```

对比：

```ts
toSpillStoreSource(source)
```

当前代码只接受：

```text
tool
session-reference
```

如果 0.1.7 union 仍为两臂：

- 保持代码不变；
- 更新定征测试说明。

如果新增 source kind：

- 不允许 default 静默吞掉；
- 在 `artifact-read` 自有 mirror 中添加对应结构；
- 更新 durable grant serialization；
- 新增 round-trip tests；
- 保留 `never` exhaustive switch。

## 7.2 `spill-policy` byte → token

搜索产品配置：

```bash
git grep -n "maxInlineBytes" -- ':!dev/agent-workflow/evidence/**'
```

如果 production/profile fixture 有：

```yaml
maxInlineBytes:
```

迁移为：

```yaml
maxInlineTokens:
```

数值不得按字节原值直接照搬。

需要读取 upstream 0.1.7 默认值，并在测试中采用：

- upstream 默认值，或
- 一个明确按 token 设计的测试阈值。

历史 dump-config/evidence 中的 `maxInlineBytes: 50000` 保留。

## 7.3 replacement composition

重新验证：

```text
base spill-local disabled
team-spill-local exactly one active provider
spillStore 无 duplicate service
```

重点测试：

```text
packages/runtime/test/team-spill-local.test.ts
packages/runtime/test/team-spill-local-composition.test.ts
strict-read-core-spill real-host smoke
```

必须覆盖：

1. unmanaged session：行为等价 upstream；
2. managed session：spill 后 durable grant；
3. root 自定义；
4. cleanupPeriodDays 传播；
5. cleanup sweep；
6. grant write failure → `saveText` reject；
7. spill file durable-before-grant；
8. source union exact mapping；
9. restart 后 grant ledger rebuild 的现有测试可跑，但若暴露 Team session-resume 问题，登记 follow-up，不在本轮改 resume。

---

# 8. U5 — Client Sessions / slots 兼容

0.1.7 release notes 明确：

> Client Sessions support multiple coexisting instances, with changes to related APIs and slots.

因此这里必须做真实 type-driven migration，不能假设旧接口继续成立。

## 8.1 重点文件

至少检查：

```text
packages/client/src/plugin/client.ts
packages/client/src/plugin/team-mount-core.ts
packages/client/src/ui/NewTeamEntry.tsx
packages/client/src/ui/TeamActivity.tsx
所有使用 ctx.sessions / session slots / conversation slots 的文件
```

## 8.2 方法

先升级依赖后直接运行：

```bash
pnpm --filter @dsh-agent-team/client typecheck
```

对每个 error 分类：

```text
A. symbol/path rename
B. signature change
C. slot props change
D. session identity changed to instance-aware form
E. test-runtime-only drift
```

修复优先级：

```text
public 0.1.7 API
> public adapter in dsh-agent-team
> graceful degradation
```

禁止：

```text
private store import
internal client module
DOM query
synthetic session selection state
```

## 8.3 必测行为

至少覆盖：

```text
Team tab mount/unmount
New Team entry
Team Activity rendering
session open/create
切换 ordinary session ↔ Team session
两个 client session instance 共存时不串 Team projection
reload 后 Team tab 可重新读取 projection
```

如果旧的“jump to conversation view” seam 在 0.1.7 仍不存在，保持原降级，不借本轮扩展。

---

# 9. U6 — MCP / capability compatibility

0.1.7 MCP 已升级官方 SDK v2，并支持：

```text
protocol negotiation
tool pagination
server without tools
resources
URI templates
```

本项目的 MCP governance 不能只验证“serverName 仍能连接”。

## 9.1 保持现有语义

现有 Blueprint initial grant：

```text
governance MCP cell 在 Team 初始化时写入 allow MCP
ask / mutation envelope 留待后续
```

本轮不改变。

## 9.2 重新验证 public seam

检查：

```text
packages/runtime/agent-setup/capability/mcp-facet.ts
packages/runtime/src/plugin/live/agent-bindings.mjs
相关 MCP capability tests
```

确认 0.1.7 下：

```text
server discovery
tool list
per-agent visibility
same DSH process / 单 live Team 的稳定性
```

本轮仍只要求此前用户裁决的 **单 live Team 稳定运行**。

不要把“多个 live Team 共用一个 MCP server”的扩展测试加入升级 blocking gate。

## 9.3 测试 server

mini-MCP fixture 至少增加/确认：

```text
一个普通 tool
分页行为不破坏发现
server 无 tools 时不导致 Team 初始化崩溃
```

Resources/URI template 属 upstream 新能力，本插件若不消费，不需要实现。

---

# 10. U7 — build / static gates

按以下顺序运行，避免全量测试噪声掩盖基础错误。

## 10.1 clean install

```bash
rm -rf node_modules
pnpm install
```

记录：

```text
node version
pnpm version
git HEAD
DSH test-use HEAD
```

## 10.2 typecheck

```bash
pnpm typecheck
```

若失败，先修 production 类型，再跑 test。

要求所有 workspace package typecheck green。

## 10.3 build

```bash
pnpm build
pnpm build:composition
pnpm check:artifacts
```

要求：

- committed dist 与 source 同步；
- `host.js` 可 import；
- `client-bundle.js` 可生成；
- `team-spill-local.js` 存在；
- `upstream-resolver.mjs` install surface 存在。

## 10.4 zero-core

运行现有 zero-core scanner。

要求：

```text
tests/deepseek-harness-test-use porcelain empty
references/deepseek-harness 不被修改
无 upstream patch
无 private subpath workaround
```

## 10.5 public-import scan

重新跑 P4-T6 / equivalent scanner。

如果 pin 数变化，仅因：

```text
真实新增/删除 downstream source file
upstream package rename
```

才更新 pin。

不得为了过 scanner 放宽 private import 规则。

---

# 11. U8 — pristine 0.1.7 real-host vertical

这是本轮最终 compatibility authority。

使用：

```text
tests/deepseek-harness-test-use @ 46a7f68b...
tests/homes/<fresh-world>
3180 family port
```

严禁使用稳定实例 `:3080`。

## 11.1 rebuild pristine DSH

按 `docs/TEST_METHODS.md` 的升级后版本执行。

`DSH_CLIENT_COMMIT_HASH` 改为：

```text
46a7f68b09
```

## 11.2 fresh install plugin

必须验证真实 package install，不仅 workspace symlink。

至少一次采用现有 git-install smoke 路径：

```text
fresh DSH_HOME
install dsh-agent-team
bundle auto-registration
boot
```

这是因为 0.1.7-rc.1 新增了 plugin compatibility/version checks，而且已有 upstream 行为变化涉及 `profiles/node_modules`。

## 11.3 场景矩阵

### V0 — Host boot

验证：

```text
host boot marker
HTTP unauthenticated 401
dsh-agent-team host row active
dsh-agent-team client row active
team-spill-local active
base spill-local disabled
无 duplicate service
无 ERR_MODULE_NOT_FOUND
无 pending required service
```

### V1 — Ordinary DSH unaffected

创建普通 session：

```text
发送普通消息
执行一个普通 tool
结束 turn
```

验证插件没有破坏普通 Agent loop。

### V2 — New Team

创建：

```text
leader
1 member
```

验证：

```text
Team projection 建立
member 创建
preset mount 成功
persona 可见
workspace 正确
model selection 正确
```

### V3 — Team tools

至少执行：

```text
send-message
report-progress
assign-task 或等价核心工作路径
```

验证 tool 调用退出，不重现 `team_send_message` 工具悬挂。

### V4 — permission/capability

验证：

```text
leader allowed tool
member allowed tool
member denied tool
strict-read normal workspace read
workspace 外无 grant → deny
```

### V5 — MCP initial grant

挂一个 mini MCP server：

```text
Blueprint allow MCP
Team 初始化
leader/member 应见的 MCP surface 正确
实际调用一次
```

### V6 — spill / artifact grant

制造大输出触发 0.1.7 token-budget spill：

```text
spillStore writes file
TeamAwareLocalSpillStore records durable grant
owner agent can read
other instance cannot read
```

这里必须以 0.1.7 的 **token budget** 触发，不再依赖旧 byte threshold。

### V7 — lifecycle

执行：

```text
member settle/archive/restore（按当前产品支持）
leader stop
```

确认 0.1.7 lifecycle 事件变化没有破坏现有 Team durable transitions。

### V8 — process stop + fresh reboot sanity

本轮仅做：

```text
停止 host
重新启动同一个 profile
确认 host 本身可以重新 boot
```

**不要把“旧 Team 是否成功恢复”作为本轮 blocking criterion。**

如果 Team resume 失败：

```text
记录日志
记录 session files
记录 service topology
标记 POST-UPGRADE SESSION-RESUME
```

然后继续完成升级收口，只要 fresh Team 主路径正常。

---

# 12. U9 — 全量测试与失败分类

运行：

```bash
pnpm test
```

不要以“必须零失败”作为唯一判断，因为当前仓库已有已知 test debt。

先记录升级前 master 的 baseline：

```text
failed files
failed test names
passed count
total count
```

升级后按集合差分分类。

## 12.1 分类

### A. PRE_EXISTING

升级前已经失败，升级后同样失败。

本轮不修。

### B. UPSTREAM_BASELINE_DRIFT

例如：

```text
event ordering
package name
session log V4 fixture
client slot shape
preset fixture
spill threshold
```

若 production 行为正常，则只更新测试。

### C. REAL_COMPAT_REGRESSION

升级后 production path 真坏：

```text
host row 不加载
Team 不能创建
agent setup 丢失
capability 不生效
MCP 不可用
spill grant 断
client Team tab 不工作
```

必须在本轮修。

### D. SESSION_RESUME_FOLLOW_UP

任何只涉及：

```text
旧 Team
跨进程重启
session migration/read
resume restoration
```

且 fresh Team 功能正常的问题，登记，不在本轮解决。

---

# 13. 需要具体修改/审查的文件清单

下面是 agent 执行时应逐项 touch/review 的最小清单。

## 必修改

```text
tests/paths.mjs
AGENTS.md
docs/TEST_METHODS.md
packages/runtime/package.json
packages/client/package.json
pnpm-lock.yaml
```

## 高概率修改

```text
packages/runtime/root-binding/harness/plugin.mjs
packages/runtime/member-residency/harness/plugin.mjs
tests/characterization/probes/agent-lifecycle/plugins/lifecycle-host.js
tests/characterization/fixtures/host-version.json
与旧 .agent-presets fixture 相关的测试文件
packages/client/src/plugin/client.ts
packages/client/src/plugin/team-mount-core.ts
client tests
```

## 必须审查但应尽量不改

```text
packages/runtime/src/plugin/host.ts
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/runtime/src/plugin/team-spill-local.ts
packages/runtime/src/plugin/artifact-grant-bridge.ts
packages/runtime/agent-setup/capability/mcp-facet.ts
cordis.patch.yml
```

这些文件只有出现**已证实的 0.1.7 public contract drift**时才改。

## 不要机械修改

```text
dev/agent-workflow/evidence/**
tests/mock/state/** 历史截图/快照
旧 release evidence
旧 0.1.5 dump-config
```

---

# 14. 对几个关键文件的预期改法

## 14.1 `packages/runtime/package.json`

预期从“混合版本”变成“单一 0.1.7 RC graph”。

不要继续保留：

```text
0.1.2-rc.1
0.1.5-rc.2
```

作为直接 DSH dependency。

旧：

```json
"@deepseek-ai/dsh-agent-presets": "0.1.2-rc.1"
```

迁移到 0.1.7 registry package，只添加实际需要的包。

## 14.2 `packages/client/package.json`

全部 client DSH package 与运行宿主对齐 0.1.7。

这是 U5 typecheck 能否提供有效信号的前提。

## 14.3 `team-spill-local.ts`

当前先不改实现。

先用 0.1.7 类型编译：

```bash
pnpm --filter @dsh-agent-team/runtime typecheck
```

只有下面任一项真实漂移才修改：

```text
LocalSpillStore constructor
Config
SaveTextSpill
SpillRef
SpillSource union
saveText signature
```

不要因为 release notes 中 `maxInlineBytes → maxInlineTokens` 就误改这里：
该变化主要属于 spill-policy，而不是 LocalSpillStore 的存储 config。

## 14.4 `agent-bindings.mjs`

重点重新验证而非主动重构：

```text
agents.create setup callback
agents.resume setup callback
agentPresets.mount
agentPresets compose
model selection
MCP registration
session durability detection
```

如果 `agent/created` 的新异步边界要求等待某初始化，必须通过真实 ordering test 证明后再改。

## 14.5 `cordis.patch.yml`

当前的：

```yaml
- id: spill-local
  disabled: true
...
- id: team-spill-local
  name: dsh-agent-team/spill-local
```

设计先保持。

检查 0.1.7 base bundle 的 row id 是否仍叫：

```text
spill-local
```

若 unchanged，不改 replacement 策略。

若 upstream row id 改名，则只改 effective replacement target，并新增 composition test 防止双 provider。

---

# 15. 最终 Gate

只有以下全部成立才判升级完成。

## G1 — Version coherence

```text
test-use == 46a7f68b...
所有直接 DSH deps == 0.1.7-rc.1
无 production package manifest 继续 pin 0.1.2/0.1.5
```

## G2 — Static

```text
typecheck green
build green
build:composition green
check:artifacts green
zero-core green
public import scanner green
```

## G3 — Core plugin

```text
host loads
client loads
Team creates
member creates
Team tools execute/return
permission enforcement correct
MCP initial grant correct
```

## G4 — Spill

```text
single spillStore provider
0.1.7 token-budget spill can trigger
managed Team grant works
cross-instance deny works
unmanaged behavior remains upstream-equivalent
```

## G5 — Client

```text
Team UI mounts
New Team works
ordinary sessions unaffected
multi-instance client session API 无串线
```

## G6 — Real-host

fresh pristine `0.1.7-rc.1` world 通过 V0–V8。

## G7 — Regression accounting

`pnpm test` 的所有新增失败都被分类：

```text
fixed
or documented PRE_EXISTING
or documented SESSION_RESUME_FOLLOW_UP
```

不得留下“原因未知的新失败”。

---

# 16. 建议提交拆分

为了方便审查，不要一个巨型提交。

建议：

```text
1. chore(upstream): pin test host to dsh 0.1.7-rc.1
2. chore(deps): align dsh package graph with 0.1.7-rc.1
3. fix(preset): migrate 0.1.7 preset fixtures and registry contracts
4. fix(compat): adapt agent lifecycle and client session surfaces
5. fix(spill): adapt 0.1.7 spill contracts if required
6. test(compat): add 0.1.7 real-host vertical coverage
7. docs(upgrade): record 0.1.7 compatibility baseline and follow-ups
```

如果某一项经验证无需代码修改，例如 `team-spill-local` API 完全 SAME，则不要制造空洞的“兼容修复”提交；在 evidence 中记录 SAME 即可。

---

# 17. 最终交付物

本地 agent 完成后应给出：

```text
1. upgrade-summary.md
2. upstream-seams.md
3. dependency-diff.md
4. typecheck/build logs
5. focused test logs
6. real-host V0–V8 summary
7. full-suite before/after failure diff
8. zero-core proof
9. test-use pristine proof
10. POST-UPGRADE FOLLOW-UP 列表
```

其中 POST-UPGRADE FOLLOW-UP 至少单列：

```text
session-resume / restart
```

即使它在本轮实测中表现正常，也不要在本轮声称已经完成 B/B+ resume 架构问题的解决；那应在升级完成后以新的 0.1.7 基线重新分析。

---

# 18. Agent 执行时的决策准则

遇到不确定项时按以下顺序：

```text
0.1.7-rc.1 实际源码
> 0.1.7 public type declarations
> real-host observation
> 本仓库 frozen contract
> 历史 0.1.5 evidence
```

禁止用历史 evidence 覆盖新版源码事实。

若某 public seam 在 0.1.7 消失：

1. 先证明 ABSENT；
2. 搜索官方 public replacement；
3. 使用 replacement；
4. 若只有 private seam 才能实现，停止并报告 `CORE_SEAM_BLOCKER`；
5. 不擅自增加 upstream patch。

---

## 最简判定

这次升级不是重做 Team runtime。

预期主要真实改动集中于：

```text
依赖统一
test-use pin
preset fixture/registry
agent lifecycle characterization
client sessions/slots 类型适配
spill-policy token budget 测试
MCP v2 回归验证
```

而以下核心结构应优先保持：

```text
TeamDomain
Blueprint authority
Agent create/resume setup composition
agentPresets public service usage
permission/capability architecture
team-spill-local replacement architecture
artifact grant authority
0-core deployment
```

只有 0.1.7 的实际 public contract 明确要求时，才对这些核心部分做最小修改。
