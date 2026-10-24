# Alpha.5 重建：中心装配层目标架构（设计草案）

> **状态：DRAFT / PROPOSED / NOT ACTIVE。** 日期：2026-10-25。随本 PR 仅提出架构与未来验收规则；**不修改现行 `AGENTS.md`、`graph.yaml`、`docs/plans/active/`、Host 或产品源码；不自动冻结运行中的 Agent、不自动启动实施、更不授权合并或发布。**
>
> 基线：本 PR 起点为 Team `master@4aaaa7b2af87f80a0fae62d9c8d9cf03d5a6fd84`；宿主实际 pin **执行时**从 `tests/paths.mjs` 读取（起草时 `639ed015397290b3745d163aafe02ffee4aa3f84`）。PR #361 仍为 draft；PR #362 的 E0/E1 **非权威**基础已合并，尚未完成 E0/E1 出口或正式权威切换。
>
> 配套：[五阶段实施计划](./five-stage-implementation-plan.md)；[第一阶段详细计划](./phase-1-freeze-inventory-feasibility.md)。上位：`AGENTS.md`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`、20260829 冻结四件、现行 Alpha.4/5 语义合同及用户已裁决约束。此文件若与已批准权限/持久化法律冲突，**冲突项停工、提交裁决**，不得暗自覆盖。

## 1. 目的、非目标与三个不可妥协的验收问题

重构针对 `packages/runtime/src/plugin/{host.ts,root.ts,live/agent-bindings.mjs,live/team-tool-plane.mjs}` 等手工接线面：阻断工具族专用逻辑持续涌入中心，消除“C1 大量绿、C2/真实 Host 不可用”的水平开发积压，同时保留唯一权限权威及既有安全语义。

| 目标 ID | 必须被真实行为证明的事实 | 不合格的替代品 |
|---|---|---|
| CA-01 无中心改动接入 | 新增一个**此前不存在**的普通 Family，只改该 Family 的实现/声明/测试以及可再生成的产物；中心通用装配**产品源文件零 diff**，固定 Host 的注册/运行/卸载正控成功 | “未来支持”“只改中心一小处”、只通过 mock register |
| CA-02 唯一安全生命周期 | `read` 与 `bash` 等不同执行模型共用同一套可信 Binding、PA/Control/Grant、代际检查、撤销与 settlement 规则；正控有真实外部效果，拒绝无副作用 | Family 各写一套审批；仅断言返回的布尔值 |
| CA-03 特殊性止于边界 | 一个真实特殊机制（例如 PTC Transport、LSP 常驻 Realm 或 Jobs Lease）通过具名 Bridge 接入通用安全核心；新增差异不使中心出现工具名特判或平行授权账本 | 在中心扩充 switch/if、另造审批系统、Bridge 绕过最终准入 |

非目标：重写 Alpha.4 TeamDomain/ControlService、重定义 Envelope/权限代数、隐式提升 Blueprint 版本、实施 Alpha.6、引入第十个产品包、新造 Host、修订上游 DSH 源码、为减少 LOC 而牺牲可观测行为、将“不支持的工具全部拒绝”宣称为已交付。

## 2. 权威边界与安全不变量

**中心治理不等于所有工具共享相同执行器。** 固定的安全协议须统一；文件、进程、网络、持久连接、远端执行的具体效果由不同受信 Provider/Bridge 实施。

| ID | 永久约束 |
|---|---|
| CI-01 | `CORE PATCH BUDGET = 0`；仅使用选定 Host pin 的公开 seam。无公开前置拦截点时标记 `CORE_SEAM_BLOCKER`，不使用私有 import、fork Host 或补丁绕行 |
| CI-02 | Alpha.4 ControlService/ApprovalCase、TeamDomain、ExternalHard、双 Envelope、Alpha.5 PA、RequestedEffectSet、单次 Grant/Binding generation 保持语义；不创建新的可写授权权威 |
| CI-03 | Team 受治理范围与普通非 Team 会话严格隔离；非 Team 原生行为不因 Team 装配发生限制或扩权；agentless/子调用不得错误继承 Team 身份 |
| CI-04 | 当前执行绑定必须由可信 Host Scope 实际 Definition/Binding 身份证明；名称、描述、工具自报、旧 Snapshot、模型可见 schemas 不足以证明实际可执行身份 |
| CI-05 | 未覆盖/未知/代际失配/未归属/Provider 不能兑现保证时，**在实际 Body/效果前拒绝**，不得自动回落原生工具体；不得让未支持工具的 typed refusal 冒充功能交付 |
| CI-06 | PA Admission / Control Ask / Fresh Recheck / Consume 的授权归属是中心唯一权威；Family 仅可提交待审参数与效果、接收受限执行能力，不可自行 mint、批准、consume 或复用 Grant |
| CI-07 | 请求的全部效果必须纳入同一授权判断；实际副作用在受信中介/Provider 约束下发生，不能信任普通 Family 的自报 effectSet 就授予无限制 Host FS/process/network |
| CI-08 | 授权/注册/执行取消与卸载有单一有序生命周期；关闭/策略变化阻断新调用并处理在途调用，旧 disposer 不得撤掉换代的新 mount；撤销和取消不得承诺无法保证的 OS 或远端强制终止 |
| CI-09 | 一次调用的执行/settlement 可审计；不得在副作用发生后自动重试；远端/后台不能证实恰好一次效果时须报告不确定状态，不以“请求已取消”冒充“效果已回滚” |
| CI-10 | Domain Authority 对设备/研究状态/远端作业的最终否决仍独立有效：Team Permit 不覆盖 Domain Permit，反之亦然 |
| CI-11 | 动态新增工具进入受审来源和待验证集合，**不**因被发现而自动可运行或已批准；来源、Scope、Binding/Provider 代际、工具原名与别名须防碰撞与漂移 |
| CI-12 | 真实发布依赖固定的 `Team SHA + Host SHA + 构建/包 digest + 来源/config/profile digest + RUN`；C1 与测试工装内 LIVE 不等于最终 Host/发布通过 |

安全真实边界：可信插件不能将同进程恶意 Host 代码沙箱化；Landlock 文件约束不等于任意网络隔离或 metadata 不可见；远端 API 不等于本地 OS 强制。Bridge 不能通过更改措辞扩张实际保证。

## 3. 目标组件与单向依赖

```text
受审 Host / Team / Profile / Provider 来源
           │
      AuthoritativeToolSources + ExpectedToolObligations  ← 控制/验证侧（只读）
           │
DSH Host public seam → HostSurfaceAdapter（注册、scoped identity、snapshot、dispose）
           │
           ▼
    GovernedFamilyRegistry（受审 contributions / 动态来源对账；非授权者）
           │
           ▼
    GovernanceKernel（唯一受信内核）
      Binding → plan/effects → PA Admit / Control Ask
      → current facts & freshness → one-shot consume
      → constrained execution capability → settlement / lease
           │
           ├── Ordinary Family: FS / image / search / shell / ...
           └── Named Host Bridge: PTC / LSP / Jobs / MCP / 特殊 transport
                      │
                  Trusted Provider / real Host effect
```

职责须可测试地独立：

1. **HostSurfaceAdapter**：仅封装 DSH 公开注册/Scope/Definition/执行 token/生命周期输入，真实来源身份与注册结果；不得自行决定用户权限。
2. **GovernedFamilyRegistry**：合成已审 Family Contribution；同名/同 Scope/多 Provider 冲突、声明遗漏或重复必须拒绝。它不变成动态授权白名单，可信的“可治理来源”与“已批准执行”分离。
3. **GovernanceKernel**：核心唯一入口/代际状态机/Grant 消费/执行能力签发/审计关联；跨 Family 一致。重用现有受审 ```ControlService、PA、tool-dispatch``` 合同及逻辑而非另造账本。
4. **Ordinary Family**：具体 Schema、原生形状、参数解析、效果请求、调用 Provider、结果格式与 family-owned 清理。实现可独立 review/单测。
5. **Named Bridge**：Host 的特殊 Transport/持久服务/后台生命周期适配；仅可向通用 Kernel 提供可信执行事件和受限能力，不得拥有审批权威。
6. **Test/Verification Plane**：只读 Census 和 TestWorld 观察真实结果；与生产权限账本无写依赖。Manifest/证据不作为执行许可。

既有 `pa-mount-registry.mjs`、`tool-dispatch`、`a5p5-tools`、`plane-effect-backends.mjs` 是候选资产，是否保留逐项由阶段 1 实测决定。**当前没有可调用的统一 `registerA5GovernedFamily`：它是拟议架构产物，不得把设计名称当成已实现 API。**

## 4. Family Contribution 契约边界（语义冻结，TS 字段待 PoC）

每个 Family 提供一个受审的、来源可验证的贡献，至少覆盖以下六个边界：

| 边界 | Family 可提供 | Kernel / Host 独占 |
|---|---|---|
| Source & Visibility | 来源选择器、支持的 native name/variant、Profile 前提、呈现名称 | 从受信配置和真实 Host Scope 得到可执行性、Binding 身份，检查同名与换代 |
| Definition & Arguments | 原生输入输出契约、closed schema、纯解析/规范化、错误等价要求 | 注册与实际 dispatch 的唯一调用路径 |
| Effects & Constraints | 按实际参数声明待审的读/写/进程/网络/Domain 等效果与目标 | 权限算法、可信资源定位、Provider 能力核对、完整效果准入与重检 |
| Execution | 只持有受限执行 handle，完成一次真实业务调用 | 唯一执行入口、Grant/Lease 有效性、pre-body 拒绝、重复调用防护 |
| Lifecycle | family-owned cleanup hook、资源撤销协作、取消能力边界 | publish→active→drain/revoke→dispose 总顺序与无老旧回调回退 |
| Result | Host 兼容结果、错误、取消/不确定终态解释 | correlation、统一结果 envelope、审计/异常时序与外部效果归因 |

注册既可由**构建期受审 Manifest 自动收集**普通 Family，也可由受信 Host/配置源动态实例化需对账的 MCP/Provider Family。前者新增工具不修改 Kernel 源文件；后者先进入 `UNKNOWN/NOT_VERIFIED`，不自动拿到授权或运行权。Manifest 的生成脚本可以改变生成产物，**不能要求为每个工具手工编辑中心源码**。禁止把外部 toolName 自动拼成任意路径/import 执行。

接口实现必须以防误用为目标：类型化的计划/执行能力、不可伪造的调用身份、缺少关键事实时不可执行，拒绝逻辑不可由 Family 自行 override。协议是否采用 TS interface、函数式 DI、闭包或 sealed 构造交给实现 Owner 选择，不因此发明通用 Plugin Framework。

## 5. 统一执行与生命周期状态机

逻辑顺序（实现前由阶段 1 核对现有审批/消费的真顺序；本图不授权改写它）：

```text
REGISTERING → VERIFIED_BUT_UNPUBLISHED → ACTIVE
                                           │ call
                                           ▼
                                BIND / PLAN / EFFECTS
                                           ▼
                                  PA ADMIT / CONTROL
                                   │ deny/unsupported
                                   ├──────────────→ REFUSED (body = 0)
                                   ▼
                              APPROVED + FRESH RECHECK
                                   │ stale/revoke
                                   ├──────────────→ REFUSED (body = 0)
                                   ▼
                             GRANT CONSUME / EXECUTE
                                   │
                         settle / cancelled / uncertain
                                   ▼
                                  TERMINAL

ACTIVE ──policy/Binding/realm change──→ DRAINING
DRAINING ──inflight settlement or bounded close──→ DISPOSED
```

核心必须单独证明：注册失败回滚没有工具暴露；真实 dispatch 没有 native body fallback；两个成员同名工具不会互用 Grant；后注册未知工具不能绕过 closed-world；取消/超时竞争不双重调用；旧 mount dispose 不会清除新 mount；进程/远端实际效果与用户可见状态区分。

不要求所有工具“立即强制取消”：如 POSIX 子进程可安全 kill owned process group，远端 Job 只能请求取消并等待事实确认；终态准确性高于表面字段一致。

## 6. 具名 Bridge 的资格与约束

**Bridge 仅解决真正不同的 Host 执行缝隙，不是工具族异常逻辑的默认垃圾桶。**

| 候选 | 为什么可能需要 Bridge | 仍必须经过的共同门 |
|---|---|---|
| PTC `run_code` | Transport 保留、外层与嵌套真实效果分离 | Scope/PA/Grant 分层、内层 effects、无旁路 |
| LSP | per-member/realm pool、Policy 代际销毁重建、Provider 对文件权限的实际控制 | 原始查询身份、最新授权、资源释放与未授权不外泄 |
| Jobs | owner/lease/后台终态、signal 与真正 job 状态不一致 | 初始准入、操作前 fresh 检查、Domain Gate、撤销/不确定终态 |
| MCP / Web | 动态来源/服务器、stdio/HTTP/redirect、外部能力边界 | 可信来源身份、动态 scope 对账、网络/文件控制不虚报 |

Bridge 资格由阶段 1 的 seam 证据决定。普通工具差异优先留在 Family；Host 原生不可替换、跨进程长生命周期或动态注册差异才升级 Bridge。如果无法得到**body 之前**的可信拦截点，禁止在 Bridge 后补“执行后拒绝”；输出 `CORE_SEAM_BLOCKER` 并停下该路径等待明确设计/范围裁决。Tool-level fork 只能在其自身许可、公开入口、完整替代能力和维护预算经过审查后作为受限方案，不能默默替代 Host patch。

## 7. 迁移策略：替换中心，不再堆叠一个中心

- 阶段 1 固定可恢复资产、失败基线和生产代码映射；旧 M2 分支（含 PR #360）作为候选/证据来源，**不等于新方案的自动合并队列**。
- 阶段 3 先建 Host 验收可用的 Canary/故障注入测具；Canary 不证明 Alpha.5 工具 GO。
- 阶段 4 在独立重构分支完成新 Kernel/Family 装配，逐步迁入一种执行模式；不要在同一 Member 中双装两套会消费授权的 Kernel。对照旧行为和已知红，任何新非 Team 扩权或安全退化都阻断。
- 旧中心注册/路由/特殊分支以“零消费者→删除”为收口，不允许永久双路兼容桥。保留旧对外行为契约、历史和可恢复版本；修改持久化格式/用户可见行为必须另经批准。
- `dist`/声明/源包/安装包同一 SHA 可再现。只通过源码运行的 kit 不能代替正式安装入口或结果渲染契约。
- 中心完工后新增普通 Family 的 Diff 应只触及 `family-owned source/test/declaration`、可再生索引和受影响的验收证据；不得因同名注册/配置加入 Kernel 手写表。

## 8. 架构 PoC / 接受与分叉

| PoC | 实验 | PASS 门 | 失败分叉 |
|---|---|---|---|
| ARC-A 插件化贡献 | 两个已有 Family + 新造测试 Family，经正式 Host 公共注册链挂载、执行、卸载 | 新 Family 零中心手工改动；同名碰撞拒绝；真实结果正确 | 纯 Manifest 缺可可信发现 → 改为可生成/验证的受审 Catalog；若仍需中心逐名硬编码，**停工重设计 Registry** |
| ARC-B 共享权限 | FS 与 confined process 的真实 allow/ask/deny、一次 Grant、revoke、非 Team 对照 | 同一 Kernel/Control/PA 生命周期；授权一致性和无副作用拒绝实测 | 是 Host seam 问题 → `CORE_SEAM_BLOCKER`；是接口职责错误 → 仅重做边界，禁止双审批内核 |
| ARC-C 特殊 Bridge | 阶段 1 按风险选一个 PTC/LSP/Jobs 代表 | 特殊行为只留 Bridge；共同授权/卸载仍有效 | 公开接口不足 → 缩为具名阻断上报，其他 Family 可继续；如果特殊路径必然污染 Kernel 核心语义，停下桥接设计 |
| ARC-D 对抗与组合 | 动态未知、跨 Scope、旧 Revision、重放、取消、掉线、旧 disposer | 未授权 body 0；成功路径恰当执行；Host World 未污染 | 安全退化 → 阻断相关集成，确定根因后一次修复复审，未收敛升级裁决 |

ARC-A/B 是**中心架构完成的硬条件**；ARC-C 须证明 Bridge 架构实际成立或登记用户裁定的接口阻断，不得假 GO；ARC-D 不允许安全红永久豁免。所有 PASS 均绑定代码/Host/包/profile/真实效果证据，不借用其它版本的局部绿。

## 9. 决策权与变更闸门

- **已在本设计中提出冻结的工程约束**：普通 Family 零中心源码改动、唯一受信安全核心、特殊 Bridge 隔离、内部可大幅重构而外部合同不变。经用户批准此方案后，目录/TS 签名/依赖注入/文件拆分不再逐项请求用户裁决。
- **保留用户级裁决**：更改 Alpha.4/5 权限或持久化法律；更改 CORE PATCH BUDGET；扩大/缩减必交工具或安全声明；无公开 seam 且没有安全替代；需要强制改变外部 API/迁移兼容承诺；风险显著超出阶段核定预算。
- **工程 Owner 自治**：独立文件布局、版本化导入生成、测试 harness 细节、非语义性重构；Contract/Security Owner 对共享内核负单一决策责任；Family Owner 拥有自家实现和局部 C2；唯一 Integrator 写集成分支并验证 merged-head。
- **STOP 定义**：发生权限旁路、跨 Scope 扩权、未授权副作用、无法说明的 native fallback、测试不能检测植入缺陷、阻断接口需要改安全法、WIP/资源超预算或独立复审仍 blocking 时，停止**受影响执行面**，登记事实→复现→Owner→影响→替代→要求裁决；可隔离的无关只读调查继续。不能将失败改写为 PASS。

本文仅确定目标/约束，不声称完整公开 Host seam 已经验证。阶段 1 的核实结果可修订实现路线，**但不能以“实现不便”为由自行削弱 CA-01/02/03 或 CI-01…12**。
