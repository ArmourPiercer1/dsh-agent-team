# ②c C2 挂载已落（B-ACT-1-PR）+ 出窗缺项单 **B-ACT-1-DEP**（host.ts 一行）

时刻：2026-10-19T07:45Z。窗口纪律执行=一次性应用、最小 diff、零邻域重构、单 commit。

## C2 落了什么（三文件，均在批准面内）

1. `team-tool-plane.mjs`：`jobsEnabled` 关闭式消费键（Gate 0c 同型；**缺省=false 按缺席零翻转**；非布尔=既有 PLANE_CONFIG_INCOMPLETE typed 拒挂）；`job_output/job_list/job_kill` 固定拼写三行（宿主 tool-jobs @639ed01539 :311-400 描述/参数逐字同名同义；无桥=既有 IO_POLICY_UNSUPPORTED 关闭式拒面，零新错误面）；natexe 受支持接管台账入册（`jobs:` 条目+理由——台账保持"本装可挂什么"的完整真话）。
2. `plane-effect-backends.mjs`：`createGovernedJobsBridge`——adapter-first 全链（`ctx.get('jobs')` 公开服务，caller=`exec.agent?.id` 派发具名、**未具名必拒绝不无过滤查询**；kill 两形不塌缩；`ensureRegistered`=归属生产者挂钩，未铸造身份永不登记 undefined）。
3. `agent-bindings.mjs`：GLUE-5 块内桥构造（每员挂载烘入**自己的** durable viewer；gateway/plane/service 三引用全懒——pb §6 铸造时序法）+ `backends.jobs` 接线 + 装配块披露注释更新（**创建归属生产者缺失=在册事实**：治理世界 confined shell 行按名拒 background=`background-not-supported`，corded:false 透传=现存活形）。

测试：RED 对**未 C2 树**真实跑档（stash 三产品文件后跑，runs/c2-RED-before-mount.log：5 红+9 绿=增量面精确）；GREEN=14/14 全文件 + natexe/pindir/int-r3 套件回归（runs/c2-GREEN-lease-and-natexe.log）；runtime/testkit typecheck 0。无新文件⇒p4t6 链 1208 不动（全套复跑中）。

## B-ACT-1-DEP（出窗缺项：host.ts 一行，不属批准窗口）

`jobsEnabled:true` 的世界需要 glue 拿到宿主 jobs 服务。glue 取服务=deps 注入制（先例 :2259 `subagents: ctx.get('subagents')`；懒形先例=同块 `agentPresets`）。**`packages/runtime/src/plugin/host.ts` 不在批准窗口 ⇒ 未动**，缺项单：

```ts
// host.ts，deps 块内（:2259 subagents 行邻域），一行，懒式（D1 agentPresets 同型）：
    jobs: () => ctx.get('jobs'),
```
- 语义：加性可选 dep；**永不入硬注入数组**——无 jobs 服务的世界逐字节不变，`jobsEnabled` 关的世界零调用；开着而服务缺=桥每调用诚实 typed 拒（`jobs-service-unavailable`），**永不成 setup 失败**。
- 落法：请协调者派 A（一行）或扩窗我落一次。未落前效果=开键世界全部管理调用诚实拒形（fail-closed 已测：runs/c2-GREEN 套件含 gateway-not-active/service-absent 两拒面）。

## 矩阵行更新

D4-jobs 装面行口径="接通已落装（单元面✅），装面端到端待 B-ACT-1-DEP + C3"。
