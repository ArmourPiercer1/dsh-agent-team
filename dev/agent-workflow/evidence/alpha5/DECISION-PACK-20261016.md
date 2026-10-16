# Alpha.5 决策包（待用户裁，2026-10-16 09:2xZ 汇总）

两项决策，均不默认旧提案、未私自收口。逐项引用两侧原文；回复格式建议"决策1: 选项x；决策2: C1=…, C2=…"。

## 决策 1 —— PR1r B3：CORE=0 下钉住"实际被执行的已核验 definition"（PR #257/#256 冻结中）
证据：review-PR1r.md @dd70ef3c（B1/B2 阻塞 + B3 四路实测）。
- **选项 (i)** 我方门内自执行已核验 definition（不调 next）：v2=0；代价=跳过他人 execute wrapper、bodyInvoked=false、结果身份仍按名重解析。
- **选项 (ii)** 门内可取消 signal wrapper + 同步 change-abort：bodies=[]；代价=abort 形拒绝、需按 (agent,name) 精确筛否则自我 DoS。
- **选项 (iii=W)** 提上游最小 seam 请求：W-1（execute waterfall 最内步之后、resolve 之后 execute 之前的可拒点）或 W-2（把已解析 definition 钉进 execution）。
- **选项 (iv=退)** 该拓扑（第三方 listener 挂我方门后+并发重注册）严格档禁用（fail-closed 声明）。
可组合（如 ii 即时缓解 + W-1 长期解）。受影响支持矩阵行：M-12、M-06、M-01/02/03/14 记 partial（选定后写入矩阵）。
**副作用矩阵（实测，供判断）**：(i)=绕过门后 listener 链+接管取消归类，结果身份三重分离（实测 "V2RENDER:ran:grep@V1"）；(ii)=链全保留但治理拒与真取消逐字段同形+筛选失败把已副作用的无关在飞改写 ABORTED（自我 DoS 最高）；W-1=当前树六面零副作用（风险全在上游接受度）；W-2=结果身份统一但"在飞跟随热替换"全局变形；(v)=运行期零自伤、M-12 不可满足+M-01/02/03/14 退 unsupported。全文=b3-options-side-effect-matrix.md（含探针原文）。

## 决策 2（**条件未证，维持冻结**——用户 2026-10-16 拒绝对闭接受，修订轮后状态）
**映射澄清（前版 C1/C2/C3 撤回）**：externalHard ≠ teamHardEnvelope（不同对象；Alpha.4 阶梯对 externalHard 无对应物系有意分工 ADR-a4:111）。**P1**（外部事实不在 ceiling 平面，由事实/执行面另层承担）成立且属规定性；**P2**（最终执行可被 admin 穿透外部边界）**不成立**——external-hard 形状经 ToolPolicyDocument 终局拒（"Team deny is final; no approval exists for it"）、live 三道外部闸 G1/G2/G3 17/17 含 "HUMAN allow cannot beat the external hard at the last mile"、注入 kernel 多余槽位不被读、G8 闸今日挡整个 admin leg。完整无省略探针+输出原文=hard-ceiling-object-mapping-reaudit.md 附录 A/B/C 与 pr2/probes/。
**R-1 修订状态（拒绝闭合后）**：①ToolPolicyDocument 扩权面：单次批准被 admission-kernel.ts:319-332 短路；源面改写**当前无生产路径**（overlay/blueprint mutation 写的是别的文档）——闭环不成立亦不判偏差=**未闭合项**。②"Team 自身 human-admin 一次性批准亦不可覆写 Team policy deny"**未找到原始设计授权**（候选条款均限定 Core 批准或不点名 rung；反向证据 ADR-001:142"lawful higher Team policy layer may override a lower ordinary deny"）⇒ :319-332 属**实现自行收紧，正当性未证，待您裁**。③勘误（origin/master=db5cb5f7 固定 SHA 复验）：tool-governance 在 master **存在**（"无此对象"作废）；tool-admission 确不存在、生产构造点=0、DORMANT 成立；两条"仅 PR2 分支"论断作废（master 已有）。④两机制分离：(a)改 Envelope=blueprint 面；(b)越过它签一次批准=human-admin rung（实测 B 链=(b)）；原以 (a) 答 (b) 属误用，已正。详见 toolpolicy-provenance.md §8.2/H 表与 hard-ceiling §8。

文档层级已逐处标注（冻结四份=语义权威现路径 docs/plans/finished/；alpha4/=active；alpha5 memo/=未来且其自述冲突须上交——未自动视同级）。

## 附：PUBLIC-seam 请求草案（待裁，不预设结果；源=review-PR1r.md :115-116）
- **W-1（reviewer 首选）**：`tools/execute` waterfall **最内步之内**、`resolveExecution` 之后、`tool.execute` 之前的可拒点（形状：接收已解析 definition 的同步 veto hook；现有面为何不可达：我方 listener 全部早于 resolve）。
- **W-2**：解析稳定执行——`createExecution`（pinned :1391）已早解析一次并在 :1436 快照 final 化，但派发路径 :1564/:1578 再按名解析 ⇒ 请求"同一 execution 内定义身份不可漂移"语义（或把已解析 definition 传入 body resolve）。
即便您选 (i)/(ii) 即时缓解，两条仍建议作为上游请求登记（不阻塞本地缓解）。

## 队列状态
PR #257（PR1r）与 PR #256（PR2，尾差已收@63778f39）合并冻结至上述裁决+修复轮+独立复核；PR3 依赖两者。bindAll 二次 bind 测试缺口已登记（修复轮补）。
