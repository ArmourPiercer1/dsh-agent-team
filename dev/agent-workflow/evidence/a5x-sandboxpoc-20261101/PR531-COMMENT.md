## PoC 第 2 轮执行结果（验证节点，branch `task/a5x-envpoc-20261031` @ `986c9518a`）——对表结论 + B2 改判 + 三个门补丁

### 1. Finding-1 对表（零代码）：执行边界可从**冻结 v4 io 语法**逐调用无损投影

- v4 封闭语法（`packages/domain/blueprint/src/blueprint-v4.ts` :77-86/:131-137，CI 测试 fixture :84/:256/:269）已携带 D7 三轴全部语义：`read/write = all{deny} | restricted{allow,ask,deny}`（互相独立，D1.2 天然成立）；`network = allow | restricted{...} | deny{default}`。分派时工具名已知 → 按该工具 binding.io 编译执行边界即可；D1.1「成员只能读蓝图允许的路径」在逐工具强制下成立。
- 成员级 `MemberPolicy` 相对 v4 的净新增 = **authoring 便利**（成员默认、聚合视图），非强制面必需。真缺口仅两处且都很小：① 未绑定工具的**模板级默认绑定**小规则（无需新 schema 世代）；② 既有 `network:restricted` 在"网络布尔化"裁决下的**降级方向**——收紧(→deny)与放大(→allow)都不能静默选，需用户裁决（我方建议 fail-closed→deny + 迁移报告点名）。
- **建议 P1-01 改道**：「v4 io 编译规范 + 模板默认绑定扩展」为正本，`blueprint-v5` 降级为 authoring-sugar 后续选项，不再阻塞 P1。
- 全文：`dev/agent-workflow/evidence/a5x-sandboxpoc-20261101/A5SF-P1-01-PROJECTION.md`。

### 2. R-B2 改判：`CORE_SEAM_BLOCKER` → `CONDITIONAL`——**零复制包裹**闭合成员界（未用 fork）

- 机制：preset roster 以包裹行替换 `terminal-bash` 行；包裹件只用**公开导出** `{name, inject, Config, apply}`，对代理后的 ctx 调 `nativeApply`，其中 `sandboxPolicy.resolve` 按成员帽强制降级 mode/workspaceRoot（`danger-full-access` 请求被钳制）。上游**零字节复制、零修改**——比 ADR D6 批准的 bounded fork 还轻一档。
- 实测（`a5x-pocB2R-20261102T112949/b2r.json`，副作用 oracle）：帽外写 secret **拒**、帽外 rootB 写**拒**、danger 尝试**钳制**、帽内正控**通过**；同腿在 run9（`a5x-pocB1-20261031T185429`）全部越界。host.log 留消费实据：`resolve session=a5x-b2r-M1-… → CAP applied root=…`。
- 诚实残余：① 读侧不设限是宿主 workspace-write 方言（本 spike 不修，披露）；② `spec.owner.session` 可信性未证明（生产需防伪造）；③ 审批 UI 对钳制的可见语义未测。
- 结论：成员粒度持久 shell OS 界属 **P1 装配工程**，非核心改动。B1 全链（grep/spawn/glob + 持久 shell）就此无核心级阻塞。

### 3. 三个门补丁（针对"全绿但仍失败"三类成因，建议入 G5/G4 验收条款）

1. **跨平面一致性 suite**：每工具 × 每策略组合同时断言「准入平面（Alpha.4 审批决策）」与「强制平面（OS/工具拒绝副作用）」一致——成因一（平面漂移）。
2. **消费证据配对**：任何策略声明必须配对「调用点确实咨询」的证据（provider 决策 ledger 或 consulted marker）——成因三（applied-but-never-consumed 静默空转；本轮 B2-R 一步 resolve 日志定案即其正例）。
3. **宿主升级演练门**：G5 增补 upgrade-drill——宿主 bump 后负腿全量复跑 + fork/包裹件 consulted marker 校验——把 fork×上游维护税（成因二）从估计变度量。

### 4. 用户裁决已登记（`dev/engineering/registry.yaml` A5X-UADJ-1/2/3，指针权威未动）

网络作用域布尔化；硬链接 = 授权别名（非逃逸，测试法保留）；基础设施 fork 可容忍（已证零复制优先）。

**仍待用户裁决**：(a) I/O 作用域呈现粒度（成员级 vs 逐工具）；(b) `network:restricted`→布尔的默认降级方向。
