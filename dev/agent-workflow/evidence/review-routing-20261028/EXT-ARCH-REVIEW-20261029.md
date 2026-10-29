# 外部架构审查（2026-10-29 21:10 CST，用户转达，针对 master e0c60bc43）— verbatim 快照

> 来源：外部审查者（同轮 R-DM-1 发现者之后的第二次外部独立审查）。用户指令：「你的工作执行得很好，请完成这些小修复，然后继续保持」。逐条处置登记于 ROUTING-LEDGER external_review_intake_2 与 REVIEW-REMEDIATION-20261028.md（R-MODEBITS / R-AUDIT-DEPTH / R-DYNIMPORT / R-ENVBLOCK-2 / R-FAMILY-SCOPE-1 / R-GROWTH-1）及 U7-R3 矩阵 v2 修订记录。

## 一、进度判断
U7-R1 基本完成、U7-R2 接近收口但不能认定全部完成；可开始准备 U7-R3 任务设计，不宜立即无约束大规模并行。#443/#444/#447/#448/#449 已合并；#446 开放未合；#450 开放待审待确认。合并成功与 CI 全绿只证明测试集合通过，不能替代修复完整性、真实 Host 适用性、跨工具族安全影响的独立审查。

## 二、进入 U7-R3 前已确认的关键风险
1. **P1**：矩阵将 team_glob/team_skill/job_list/workflow 等 10 个 L3 缺口划为 "mock-lane 可证，无需 boot"，而验收契约规定 L3=真实 Host 类型化拒绝+零副作用、L4=真实 Host 授权执行+独立观测读回。mock 可证明拒绝逻辑，不能单独把 L3 升 PROVEN。workflow L3 用 State Family mock 臂跨越被审工具身份边界。正确做法：拆 "C1 拒绝逻辑已准备" 与 "C2 Host 拒绝及零副作用待证明"；可先批量完成 C1，不得提前提升 L3 台账状态。
2. **P1**：不得把"类型化拒绝"重定义为 L4 正向成功（#450 曾对 read_image 提出该候选）。read_image/pwsh/workflow/UI/web_search 二选一：纳入 Alpha.5 承诺支持并补完整 L4，或明确不纳入（保留 DISCLOSED/NOT_VERIFIED 且写入版本范围/安装说明/发布门禁）。不得改"成功"语义消缺口。
3. **P2（扩展前加固）**：FamilyAssembly 暴露 hostService:(name)=>hostService(name)→ctx.get(name) 无按 Family 白名单；injected 自 input.backends 浅展开+浅冻结。字段白名单不单独保证 Family 拿不到其他 Host Service。"不能取得权限接口"需限定为受信代码+受审导入+约定用法。建议：逐 Family 允许服务清单；验证 input.backends 只供已声明端口；未申报服务名/权限型服务/跨 Family 注入负控；如需改中心能力契约，单独具名 Center Interface PR + 重验 ARC-A/B/D。非已确认生产逃逸。

## 四、代码风险分级
P1 验收语义分类冲突（阻断批量计划）；P1 AC 部分工具缺生产 Host 接口不能仅靠重跑 C2（阻断对应实施）；P2 Family Host Service 面过宽+导入审计不完整（先边界 PoC）；P2 状态/token 无总量约束（大规模长寿命前）；P2 #446 判据未完全机械保证来源真实性；P2 #448 只有 C1 无合并后真实 Host 复测（G5 前补）；P2/P3 #443/#447 纵深遗漏（并行小 PR）。
1. AC 六 L4 格不能统一 C2 复证：subagent/subagent_fork 有 subagents.start() 接线但正向需重验；send_message/interrupt_agent 以 agentTeams 服务在场为前提；workflow runWorkflow 无生产接线；list_subagent_models Tier A 默认可空转。先分别 Host API PoC + 权限约束 + 接线，再正向验收，否则重演"大量 C1 通过、真实 Host 只会拒绝"。
2. #446 gateEnvBlock 只查形状，同形伪造可入判（R446-27b 已登记 R-ENVBLOCK-2）。当前调用点从真实捕获构造，不判立即阻断；多 Family 复用前需来源验证+因果关联+伪造负控。合并后至少一次真实 Host Web C2 验证 NOT_REACHED 全链。
3. eb3-family-boundaries 正则不识别计算型动态导入（对照表：import('lit') 识别、const p=...; import(p) 不识别、import(a+b) 不识别）；Descriptor SHA 非运行时完整性证明。扩展前禁未审计算动态导入或 AST+封闭清单。
4. 资源增长：fs-state-store 单记录 256KiB/1024 scope/256 appliedIds 有界，但全局 applied/ 标记、审计 JSONL 无上限；tokenLedger Map/consumedGrantIds Set 随执行 ID 增长。需生命周期设计（不可裸删历史：重放安全依赖）+长寿命压力测试（内存/文件数/inode/锁清理/重启重放拒绝/额度耗尽行为）。
5. 纵深遗漏：#443 fstat 后并发新硬链接仍暴露追加内容（目录信任假设入文）；ledgerBytes stat() 随符号链接（敌对目录不可作零写入 Oracle）；skipIf(isRoot) 两测试改确定性错误注入；#447 比较 `mode & 0o777` 漏 setuid/setgid/sticky，扩展全模式位+负控。不足以否定 G4，不建议全推迟到发布前。

## 五、建议门禁（分级放行）
1) U7-R2 正式收口：#446 完成合并审查+合并后判据验证；#448 一次真实 Host C2 确认新版 Runner 不依赖 --kill-after 经验值。2) 修订 #450：每格记工具/C1C2C3 要求/真实 Host 接口可用性/证据类型 RUN-CASE/预期独立 Oracle/代码 Owner/测试 Owner/产品前提/停工条件；L3 不得纯 mock 晋级、L4 不得类型化拒绝替代。3) 两工具试点先行（建议 team_glob + job_list）验证 C1→分支 C2→合并后跨 Family C2→台账升级全链，两 Owner+一 Integrator，不建新调度框架。4) 缺生产接口工具先 PoC（send_message/interrupt_agent/workflow/present/web_search），新增 Host Service/中心接口先具名架构决策。5) G5 前固定候选独立安全+产品验收：强制 --candidate-sha，区分 8 格历史 CASE_PROVEN 与 RUN_PROVEN，补 R-G4R-1a/R-ORACLE-1/正式安装 Profile，补齐生产 Home/沙箱/非 Team Native/恢复/取消/跨 Scope/动态工具变化负控；不得依赖历史 G4 成绩。

## 六、最终裁决建议
继续 U7-R2=放行；U7-R3 需求与逐工具契约设计=放行；有界 PoC/两工具试点=有条件放行；按 #450 原方案批量 29 格=暂不放行（先修订分类）；需新增中心/Host 能力的工具=单独架构门禁；G5 产品验收与发布=仍需独立裁决。

## 七、架构健康度
中心治理=良好（无新确定性授权绕过）；Family 模块化=良好；生产权限边界=方向合理但 Host Service 能力与动态导入审计需强化；工具成熟度=不均衡（部分缺真实 Host 公共接口）；CI/证据纪律=较好但候选绑定须严格执行；测试基础设施=明显改善，#446/新 Crash C2 待收口；长时间自举可靠性=未充分证明。核心判断：**中心不再是主要不确定性来源，无需再次全面架构重做**；U7-R3 组合爆炸会放大"mock 验证过/Host 端口待接/稳定拒绝即完成"式模糊表述，先修分类、完成 #446 与关键 C2、两工具试点证明全链后再批量。审查为代码与证据层面架构裁决，非产品安全认证（未在本地环境重跑全套）。
