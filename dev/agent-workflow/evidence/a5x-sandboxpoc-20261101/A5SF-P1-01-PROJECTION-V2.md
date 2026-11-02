# A5SF-P1-01 对表 v2（PoC banner）：四格逐项来源表 + 对反驳的事实核对

> 输入：更新后 PR #531 @ `dbc11f912`（ADR D7 双轴修订、DELTA-POC-AFTER-B2R、P1 修订）。
> 方法：只读代码 + 本轮差量实验（`a5x-pocB2R2-*`）。零实现改动。
> 本文件**替代** v1 对表中两处过强表述（撤回声明见 §4）。

## 1. v4 语法的结构事实（源证：`packages/domain/blueprint/src/blueprint-v4.ts` + `schema.ts` + `types.ts`）

1. v4 文档面 = 冻结 v3 面 + 可选顶层 `toolBindings` 族；v4 解析器**休眠**：`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` 保持 `[3]`，生产入口对 `schemaVersion: 4` 拒绝（`SCHEMA_VERSION_MISMATCH`，a5sr2 锁定）。"复用 v4"隐含翻档这一步（不可逆步骤已单列）。
2. `toolBindings[]` 条目封闭形 = `{ owner, name, authorization, io{read,write,network}, execution{implementationOrigin,executionBoundary} }`。
3. **`owner` = 自由标识符串**（validateNameLike：非空、≤128、无控制符）。解析器**不与 `members[]` 模板做引用校验**——拼错成员名、指向不存在成员、同一 (owner,name) 重复条目，语法层都不拒绝（全文件无重复键检查）。
4. 模板面（`BLUEPRINT_TEMPLATE_FIELDS`）= `{templateId, displayName, description, persona, modelPreference, contextPolicy, capabilities}`；`capabilities.permissions` = `TemplatePermissionPolicy`（静态参数级权限，absent = 无参数级权限）——这是 Alpha.4 静态轴，与 toolBindings.io 是**两个独立词汇面**。
5. 语法法：缺席 = 未声明治理、**绝非扩张**；声明即全字段显式（无默认，D-03）；closed-set 拒绝未知枚举/字段。

## 2. 四格对表（按 DELTA-POC §3 要求）

| 格 | read 来源 | write 来源 | network 来源 | ask 批准边界 | 工具未声明时 | effective ceiling |
| --- | --- | --- | --- | --- | --- | --- |
| (Member A, bash) | v4 条目 `{owner:'A',name:'bash'}.io.read` 若存在 | 同 write 车道 | 同 network 车道（布尔化裁决后的投影） | Alpha.4 审批（D1.4 唯一准入源）；ask 车道 ≠ 硬允许，执行域建立前必须落到结论 | 条目录 = 仅成员上界约束（GENERIC-02：上界对成员所有工具生效） | `MemberIoCeiling(A) ∩ 条目io`（交集语义 = ADR GENERIC-02） |
| (Member B, bash) | 条目 `{owner:'B',name:'bash'}`（与 A 条目并存：**语法可写、可解析**——无重复键拒绝，两条目各自封闭校验） | 同 | 同 | 同 | 同 | `MemberIoCeiling(B) ∩ 条目io` |
| (Member A, read 工具) | 条目 `{owner:'A',name:'read'}`，可在 bash 条目基础上**进一步收窄**（∩ 语义） | 同 | 同 | 同 | 同 | `MemberIoCeiling(A) ∩ read条目io` |
| (Member A, 未绑定 CLI) | **无条目标记**——语法法"缺席=未声明治理"→ 不新增约束也不豁免：生效 = 成员上界本身 | 同 | 同 | 准入仍走 Alpha.4（工具 allow/ask/deny 与 I/O 上界分层） | —（本即未声明格） | `MemberIoCeiling(A)` 单独生效 |

要点：
- **(Member A, bash) 与 (Member B, bash) 的差异上界在 v4 词汇内可写**（两条目、同 name、不同 owner、不同 io）。反驳中"单独读取 bash 的 binding.io 无法得出两个 Member 各自不同上界"——**按当前解析器成立**，因为 owner 无引用闭包、无运行时编译器把它绑到 MemberInstance；但这是**接线缺口**，不是词汇缺口。
- 词汇真缺口（v4 没有、必须加法式补）：`memberIdentity`（引用闭合）、`revision`（策略代际——本轮 D-PTY-04 实测的 stale-domain 危害正是代际缺失的后果）、成员级默认车道。
- **强制后端词汇缺口（比 authoring 缺口更硬）**：宿主 `SandboxPolicy` = `{mode ∈ {read-only, workspace-write, danger-full-access}, workspaceRoot}` 单根三态。bwrap：`--ro-bind / /` +（workspace-write）`--bind root`（rw）；landlock：`readOnly:['/'] + readWrite:[root]`。**"写 B 不可读 B"（write-only 根）与"逐路径读白名单"在该词汇内不可表达**（本轮 D-FS-02 活体 RED 佐证，见 b2r2.json）。→ 独立读写轴 = 宿主策略词汇的加法式扩展需求，wrapper 层无法伪造（wrapper 只能钳制 mode/root，造不出新 mode）。

## 3. 对反驳的逐点事实核对

| 对方主张 | 核对结果 |
| --- | --- |
| danger 腿非原生提权（bash 参数只有 command） | **成立**。`tool-bash-persistent` lib：`parameters: { command }` 唯一。v1 的 `sandbox_permissions` 腿作废为提权证据；真实提权面 = session 级 `sandbox/mode` 事件（`setSandboxMode()`，session-mode.ts "THE write path"），本轮已活体复测（D-BASH-03） |
| includes 匹配 + `return base` = 静默越权回退 | **成立**（v1 设计缺陷）。v2 wrapper 改精确 session-id 键 + 无映射**拒绝 spawn**（fail-closed），CTL lane 负控实测 |
| 读侧仍越界 | **成立且本轮量化**：跨成员读（A 读 B 根、B 读 A 根）在 OS 域内成功——ro-bind 全域可读，宿主无逐路径读轴（D-FS-02 RED ×2） |
| "无损投影"过强 | **接受撤回**（见 §4）。修正表述：v4 词汇**逐格**可表达三轴（含双成员同工具差异），但 (a) 成员轴无引用闭包/编译器/代际，(b) 强制后端词汇不含独立读写轴——两者都是真实加法式工作，非纯 sugar |
| "MemberPolicy 只是 UI 糖" | **撤回**。成员轴 = 引用闭合 + 编译器 + 代际管理 = 能力扩展；但**仍不需要新 schema 世代**（v4 面 + 最小成员上界字段即可） |
| `restricted`→deny 默认降级 | **撤回**，采纳对方 `IO_POLICY_UNSUPPORTED` + 显式迁移（不静默改变作者声明） |
| 持久 PTY stale 域 | **成立且实测**（D-PTY-04）：cap 代际变更后旧 PTY 域仍按旧根放行；原生另有 `sandbox/mode` 栅栏（活跃 PTY 期间改模式 throw，terminal-bash lib:930 区）——drain-first 是原生机制 |

## 4. 撤回与最终立场

1. 撤回 v1 之"执行边界 100% 可从 v4 无损投影"、"v5/新语法世代完全不需要"、"restricted→deny 建议"。
2. 维持：零复制公开包裹件优先于 fork（B2 CONDITIONAL 证据不变）；三门禁方向不变。
3. 新立场（与更新后 PR 一致处）：P1-01 = 能力对表（本文件）+ 最小成员上界加法式字段（memberIdentity 引用闭合 / revision / 成员默认车道）+ 编译规则（未声明格 = 成员上界单独生效）；**独立读写轴是宿主策略词汇的扩展需求**，wrapper 不解决，需单独立项（影响 bwrap/landlock/seatbelt 三 profile + resolve 词汇）——这是本轮 PoC 对 P1 排序最重的新增输入。
